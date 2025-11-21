import { supabase } from '../utils/supabaseClient.js';

const MAX_SESSIONS = 200;
const sessions = [];
let sessionsLoaded = false;
let currentSessionFilter = 'all';

function formatAccuracy(value){
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  const percent = value > 1 ? value : value * 100;
  return `${percent.toFixed(1)}%`;
}

function formatTimestamp(value){
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getNameFromProfile(profile){
  if (!profile) return 'Unknown';
  const first = profile.first_name?.trim() ?? '';
  const last = profile.last_name?.trim() ?? '';
  const combined = `${first} ${last}`.trim();
  if (combined) return combined;
  if (profile.full_name?.trim()) return profile.full_name.trim();
  return profile.username || 'Unknown';
}

function renderSessions(filter = currentSessionFilter){
  const tbody = document.getElementById('sessionsTable');
  if (!tbody) return;

  currentSessionFilter = filter || 'all';
  const normalizedFilter = currentSessionFilter.toLowerCase();

  if (!sessionsLoaded){
    tbody.innerHTML = `<tr><td colspan="4" class="muted">Loading recent activity...</td></tr>`;
    return;
  }

  const filteredSessions = normalizedFilter === 'all'
    ? sessions
    : sessions.filter((session) => session.difficultyKey === normalizedFilter);

  if (!filteredSessions.length){
    tbody.innerHTML = `<tr><td colspan="4" class="muted">No recent activity for this filter.</td></tr>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  filteredSessions.forEach((session) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${session.name}</td>
      <td>${session.accuracy}</td>
      <td>${session.difficulty}</td>
      <td>${session.time}</td>
    `;
    fragment.appendChild(tr);
  });

  tbody.innerHTML = '';
  tbody.appendChild(fragment);
}

export async function loadRecentSessions(filter = currentSessionFilter) {
    const tbody = document.getElementById('sessionsTable');
    if (!tbody) return;
  
    currentSessionFilter = filter || 'all';
    sessionsLoaded = false;
    tbody.innerHTML = `<tr><td colspan="4" class="muted">Loading recent activity...</td></tr>`;
  
    try {
      // Fetch user_progress with related user_profiles in one query
      const { data, error } = await supabase
        .from('user_progress')
        .select(`
          id,
          accuracy,
          difficulty,
          last_updated,
          user_profiles!inner(first_name, last_name, full_name, username)
        `)
        .order('last_updated', { ascending: false })
        .limit(MAX_SESSIONS);
  
      if (error) throw error;
  
      if (!data || data.length === 0) {
        sessionsLoaded = true;
        tbody.innerHTML = `<tr><td colspan="4" class="muted">No recent activity yet.</td></tr>`;
        return;
      }
  
      // Map rows to sessions
      sessions.splice(0, sessions.length, ...(data.map((row) => {
        const difficultyLabel = (row.difficulty || '—').trim();
        return {
          id: row.id,
          name: getNameFromProfile(row.user_profiles),
          accuracy: formatAccuracy(Number(row.accuracy)),
          difficulty: difficultyLabel,
          difficultyKey: difficultyLabel.toLowerCase(),
          time: formatTimestamp(row.last_updated)
        };
      })));
  
      sessionsLoaded = true;
      renderSessions(currentSessionFilter);
    } catch (err) {
      console.error('Failed to load recent sessions:', err);
      sessionsLoaded = false;
      tbody.innerHTML = `<tr><td colspan="4" class="muted">Unable to load recent activity.</td></tr>`;
    }
  }
  

async function loadLeaderboard(limit = 40){
  const tbody = document.getElementById('leaderboardTableBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="4" class="muted">Loading...</td></tr>`;

  try {
    const { data, error } = await supabase
      .from('leaderboard')
      .select(`
        username,
        total_points,
        average_accuracy
      `)
      .order('total_points', { ascending: false })
      .limit(limit);

    if (error) throw error;

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="muted">No leaderboard data yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    data.forEach((row, index) => {
      const name = (() => {
        if (row.user_profiles?.first_name) {
          return `${row.user_profiles.first_name} ${row.user_profiles.last_name ?? ''}`.trim();
        }
        if (row.user_profiles?.full_name) {
          return row.user_profiles.full_name.trim();
        }
        return row.username || 'Unknown';
      })();
      const accuracy = typeof row.average_accuracy === 'number'
        ? (() => {
            const value = Number(row.average_accuracy);
            const percent = value > 1 ? value : value * 100;
            return `${percent.toFixed(1)}%`;
          })()
        : '—';
      const points = Number(row.total_points || 0).toLocaleString();

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${name}</td>
        <td>${points}</td>
        <td style="text-align:right;">${accuracy}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load leaderboard:', err);
    tbody.innerHTML = `<tr><td colspan="4" class="muted">Unable to load leaderboard.</td></tr>`;
  }
}

async function loadTotalUsers() {
    const totalUsersEl = document.getElementById('totalUsers');
    if (!totalUsersEl) return;
  
    try {
      // Count all users
      const { count, error } = await supabase
        .from('user_profiles')
        .select('id', { count: 'exact' }); // Use exact count
  
      if (error) throw error;
  
      totalUsersEl.textContent = typeof count === 'number' ? count.toLocaleString() : '—';
    } catch (err) {
      console.error('Failed to load total users:', err);
      totalUsersEl.textContent = '—';
    }
}
  
  
  

async function personalizeSidebar(){
  const footer = document.getElementById('sidebarFooterName');
  if (!footer) return;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) {
      footer.textContent = 'Admin';
      return;
    }

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('first_name, full_name')
      .eq('id', userId)
      .single();

    if (error) throw error;

    const firstName =
      (profile?.first_name && profile.first_name.trim()) ||
      (profile?.full_name?.split(' ')[0]) ||
      'Admin';
    footer.textContent = firstName;
  } catch (err) {
    console.error('Failed to fetch admin profile:', err);
  }
}

function initLogoutModal(){
  const logoutBtn = document.getElementById('logoutBtn');
  const modal = document.getElementById('adminLogoutModal');
  const confirmBtn = document.getElementById('confirmAdminLogout');
  const cancelBtn = document.getElementById('cancelAdminLogout');

  if (!logoutBtn || !modal) return;

  const closeModal = () => modal.classList.remove('open');

  logoutBtn.addEventListener('click', () => modal.classList.add('open'));
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      const { error } = await supabase.auth.signOut();
      if (error) {
        alert('Logout failed. Please try again.');
        console.error('Admin logout error:', error);
        return;
      }
      window.location.href = '/login';
    });
  }
}

function initDashboard(){
  personalizeSidebar();
  loadTotalUsers();          // Load total users
  loadRecentSessions('all'); // Load recent quiz sessions
  loadLeaderboard(40);       // Load leaderboard

  const filterSelect = document.getElementById('filterDifficulty');
  if (filterSelect) {
    filterSelect.addEventListener('change', (e) => {
      const value = e.target.value || 'all';
      renderSessions(value);
    });
  }

  initLogoutModal();
}

document.addEventListener('DOMContentLoaded', initDashboard);

// Expose a small API for quick editing in the browser console
window.InQUIZ = {
  setStats(stats){
    if(stats.totalUsers) document.getElementById('totalUsers').textContent = stats.totalUsers;
    if(stats.activeToday) document.getElementById('activeToday').textContent = stats.activeToday;
    if(stats.avgScore) document.getElementById('avgScore').textContent = stats.avgScore + '%';
    if(stats.easyAvg) document.getElementById('easyAvg').textContent = stats.easyAvg;
  },
  setSessions(arr){
    while(sessions.length) sessions.pop();
    arr.forEach(item => {
      const difficultyLabel = item.difficulty?.toString().trim() || '—';
      sessions.push({
        name: item.name || 'Unknown',
        accuracy: typeof item.accuracy === 'string' ? item.accuracy : formatAccuracy(Number(item.accuracy)),
        difficulty: difficultyLabel,
        difficultyKey: difficultyLabel.toLowerCase(),
        time: item.time || formatTimestamp(item.last_updated)
      });
    });
    sessionsLoaded = true;
    renderSessions(document.getElementById('filterDifficulty')?.value || currentSessionFilter);
  },
  refreshLeaderboard: () => loadLeaderboard(40),
  refreshSessions: () => {
    const selected = document.getElementById('filterDifficulty')?.value || currentSessionFilter;
    return loadRecentSessions(selected);
  },
  refreshTotalUsers: () => loadTotalUsers()
};
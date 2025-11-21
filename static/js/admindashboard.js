import { supabase } from '../utils/supabaseClient.js';

const MAX_SESSIONS = 200;
const SUBQUESTION_COUNT_BY_DIFFICULTY = {
  easy: 2,
  medium: 2,
  hard: 3
};
const CHOICES_PER_SUBQUESTION = 4;
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
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Loading recent activity...</td></tr>`;
    return;
  }

  const filteredSessions = normalizedFilter === 'all'
    ? sessions
    : sessions.filter((session) => session.difficultyKey === normalizedFilter);

  if (!filteredSessions.length){
    tbody.innerHTML = `<tr><td colspan="5" class="muted">No recent activity for this filter.</td></tr>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  filteredSessions.forEach((session) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${session.name}</td>
      <td>${session.accuracy}</td>
      <td>${session.mistake}</td>
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

  tbody.innerHTML = `<tr><td colspan="5" class="muted">Loading recent activity...</td></tr>`;

  try {
    const { data, error } = await supabase
      .from('user_progress')
      .select(`
        student_id,
        id,
        accuracy,
        mistake,
        difficulty,
        last_updated,
        user_profiles (
          first_name,
          last_name,
          full_name,
          username
        )
      `)
      .order('last_updated', { ascending: false })
      .limit(MAX_SESSIONS);

    if (error) throw error;

    if (!data || data.length === 0) {
      sessionsLoaded = true;
      tbody.innerHTML = `<tr><td colspan="5" class="muted">No recent activity yet.</td></tr>`;
      return;
    }

    // Clear old sessions and populate new ones with the latest row per student
    const seenStudents = new Set();
    sessions.length = 0;

    data.forEach((row) => {
      const studentId = row.student_id || 'unknown';
      if (seenStudents.has(studentId)) return;
      seenStudents.add(studentId);

      const profile = row.user_profiles || {}; // safety
      const rawDifficulty = row.difficulty ? row.difficulty.toString().trim() : '—';
      const normalizedDifficulty = rawDifficulty === '—'
        ? rawDifficulty
        : rawDifficulty.charAt(0).toUpperCase() + rawDifficulty.slice(1).toLowerCase();

      const mistakeValue = row.mistake != null ? Number(row.mistake) : null;
      const formattedMistake = mistakeValue != null && !Number.isNaN(mistakeValue) 
        ? mistakeValue.toLocaleString() 
        : '—';

      sessions.push({
        id: row.id,
        name: getNameFromProfile(profile),
        accuracy: formatAccuracy(Number(row.accuracy)),
        mistake: formattedMistake,
        difficulty: normalizedDifficulty,
        difficultyKey: rawDifficulty.toLowerCase(),
        time: formatTimestamp(row.last_updated)
      });
    });

    sessionsLoaded = true;
    renderSessions(currentSessionFilter);

  } catch (err) {
    console.error('Failed to load recent sessions:', err);
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Unable to load recent activity.</td></tr>`;
  }
}

  

async function loadLeaderboard(limit = 40){
  const tbody = document.getElementById('leaderboardTableBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="3" class="muted">Loading...</td></tr>`;

  try {
    const { data, error } = await supabase
      .from('leaderboard')
      .select(`
        username,
        total_points
      `)
      .order('total_points', { ascending: false })
      .limit(limit);

    if (error) throw error;

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="muted">No leaderboard data yet.</td></tr>`;
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
      const points = Number(row.total_points || 0).toLocaleString();

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${name}</td>
        <td>${points}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load leaderboard:', err);
    tbody.innerHTML = `<tr><td colspan="3" class="muted">Unable to load leaderboard.</td></tr>`;
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
      footer.textContent = '';
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

async function getNextId(tableName){
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('id')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    // If no data exists, start from 1, otherwise use the last ID + 1
    const lastId = data?.id ?? 0;
    return lastId + 1;
  } catch (err) {
    console.error(`Error getting next ID for ${tableName}:`, err);
    throw err;
  }
}

function getSubQuestionCount(difficulty){
  return SUBQUESTION_COUNT_BY_DIFFICULTY[difficulty?.toLowerCase()] ?? SUBQUESTION_COUNT_BY_DIFFICULTY.easy;
}

function createSubQuestionFieldset(stepNumber){
  const fieldset = document.createElement('fieldset');
  fieldset.classList.add('subquestion-fieldset');
  fieldset.dataset.step = String(stepNumber);

  const choicesInputs = Array.from({ length: CHOICES_PER_SUBQUESTION }, (_, idx) => `
      <label>
        Choice ${idx + 1}
        <input type="text" data-field="choice" placeholder="Choice ${idx + 1}" required />
      </label>
    `).join('');

  fieldset.innerHTML = `
    <legend>Subquestion ${stepNumber}</legend>
    <label>
      Prompt
      <textarea rows="3" data-field="question" placeholder="Enter the subquestion prompt" required></textarea>
    </label>
    <div class="choices-grid">
      ${choicesInputs}
    </div>
    <label>
      Correct answer
      <input type="text" data-field="correct" placeholder="Exact correct answer" required />
    </label>
    <label>
      Incorrect feedback (optional)
      <textarea rows="2" data-field="incorrectFeedback" placeholder="Shown when the answer is wrong"></textarea>
    </label>
  `;

  return fieldset;
}

function renderSubQuestionFields(container, count){
  if (!container) return;
  container.innerHTML = '';
  for (let step = 1; step <= count; step += 1){
    container.appendChild(createSubQuestionFieldset(step));
  }
}

function collectSubQuestionData(container){
  if (!container) return { valid: false, error: 'Missing subquestion container.' };
  const fieldsets = Array.from(container.querySelectorAll('.subquestion-fieldset'));
  if (!fieldsets.length){
    return { valid: false, error: 'At least one subquestion is required.' };
  }

  const subQuestions = [];

  for (const fieldset of fieldsets){
    const stepLabel = fieldset.dataset.step || '?';
    const question = fieldset.querySelector('[data-field="question"]')?.value.trim();
    if (!question){
      return { valid: false, error: `Subquestion ${stepLabel} needs a prompt.` };
    }

    const choiceInputs = Array.from(fieldset.querySelectorAll('[data-field="choice"]'));
    const choices = choiceInputs.map((input) => input.value.trim());
    if (choices.some((choice) => !choice)){
      return { valid: false, error: `Please fill all choices for subquestion ${stepLabel}.` };
    }

    const correctAnswer = fieldset.querySelector('[data-field="correct"]')?.value.trim();
    if (!correctAnswer){
      return { valid: false, error: `Please provide the correct answer for subquestion ${stepLabel}.` };
    }

    const incorrectFeedback = fieldset.querySelector('[data-field="incorrectFeedback"]')?.value.trim() || null;

    subQuestions.push({
      question,
      choices,
      correctAnswer,
      hintId: null,
      incorrectFeedback
    });
  }

  return { valid: true, items: subQuestions };
}

function initCreateQuizModal(){
  const modal = document.getElementById('createQuizModal');
  const createQuizBtn = document.getElementById('createQuizBtn');
  const form = document.getElementById('createQuizForm');
  const difficultySelect = document.getElementById('quizDifficulty');
  const subQuestionsContainer = document.getElementById('subQuestionsContainer');
  const errorBox = document.getElementById('createQuizError');
  const submitBtn = document.getElementById('submitQuizBtn');
  const cancelBtn = document.getElementById('cancelCreateQuiz');
  const closeBtn = document.getElementById('closeCreateQuizModal');
  const mainQuestionInput = document.getElementById('mainQuestionInput');

  if (!modal || !createQuizBtn || !form || !difficultySelect || !subQuestionsContainer || !submitBtn || !mainQuestionInput){
    return;
  }

  let isSubmitting = false;

  const resetFormState = () => {
    form.reset();
    difficultySelect.value = 'easy';
    renderSubQuestionFields(subQuestionsContainer, getSubQuestionCount(difficultySelect.value));
    if (errorBox) errorBox.textContent = '';
  };

  const openModal = () => {
    resetFormState();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    mainQuestionInput.focus();
  };

  const closeModal = () => {
    if (isSubmitting) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  };

  createQuizBtn.addEventListener('click', openModal);
  cancelBtn?.addEventListener('click', closeModal);
  closeBtn?.addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });

  difficultySelect.addEventListener('change', () => {
    renderSubQuestionFields(subQuestionsContainer, getSubQuestionCount(difficultySelect.value));
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    const mainQuestion = mainQuestionInput.value.trim();
    if (!mainQuestion){
      if (errorBox) errorBox.textContent = 'Main question is required.';
      mainQuestionInput.focus();
      return;
    }

    const { valid, error, items } = collectSubQuestionData(subQuestionsContainer);
    if (!valid){
      if (errorBox) errorBox.textContent = error;
      return;
    }

    const difficultyValue = difficultySelect.value.toLowerCase();
    const difficultyFormatted = difficultyValue.charAt(0).toUpperCase() + difficultyValue.slice(1);

    isSubmitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
    if (errorBox) errorBox.textContent = '';

    try {
      const nextMainId = await getNextId('main_questions');

      const { data: mainInsert, error: mainError } = await supabase
        .from('main_questions')
        .insert({
          id: nextMainId,
          main_question: mainQuestion,
          difficulty: difficultyFormatted
        })
        .select('id')
        .single();

      if (mainError) throw mainError;
      const mainQuestionId = mainInsert?.id;
      if (!mainQuestionId) throw new Error('Main question was created without an ID.');

      // Get the last ID from sub_questions table to ensure we use the next available ID
      const nextSubIdStart = await getNextId('sub_questions');
      console.log('Next sub_question ID will start at:', nextSubIdStart);

      // Track incorrect_feedback values to ensure uniqueness
      const usedFeedback = new Set();
      
      const payload = items.map((item, index) => {
        // Handle incorrect_feedback unique constraint
        // If empty/null, set to null (multiple nulls are allowed in UNIQUE constraint)
        // If duplicate text, append a unique suffix
        let incorrectFeedback = item.incorrectFeedback?.trim() || null;
        
        if (incorrectFeedback && incorrectFeedback !== '') {
          // Check if this feedback text was already used in this batch
          if (usedFeedback.has(incorrectFeedback)) {
            // Make it unique by appending the step number
            incorrectFeedback = `${incorrectFeedback} (Step ${index + 1})`;
          }
          usedFeedback.add(incorrectFeedback);
        }

        return {
          id: nextSubIdStart + index,
          main_question_id: mainQuestionId,
          step_number: index + 1,
          question: item.question,
          choices: item.choices,
          correct_answer: item.correctAnswer,
          hint_id: item.hintId,
          incorrect_feedback: incorrectFeedback
        };
      });

      const { error: subInsertError, data: subInsertData } = await supabase
        .from('sub_questions')
        .insert(payload)
        .select('id');

      if (subInsertError) {
        console.error('Sub question insert error:', subInsertError);
        console.error('Payload that failed:', payload);
        throw subInsertError;
      }
      
      console.log('Successfully inserted sub_questions with IDs:', subInsertData?.map(s => s.id));

      // Clear all form fields after successful creation
      resetFormState();
      
      closeModal();
      alert('Quiz created successfully.');
    } catch (err) {
      console.error('Failed to create quiz:', err);
      if (errorBox) errorBox.textContent = err.message || 'Failed to create quiz. Please try again.';
    } finally {
      isSubmitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Quiz';
    }
  });
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
  initCreateQuizModal();
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
      const mistakeValue = item.mistake != null ? Number(item.mistake) : null;
      const formattedMistake = mistakeValue != null && !Number.isNaN(mistakeValue) 
        ? mistakeValue.toLocaleString() 
        : '—';
      sessions.push({
        name: item.name || 'Unknown',
        accuracy: typeof item.accuracy === 'string' ? item.accuracy : formatAccuracy(Number(item.accuracy)),
        mistake: formattedMistake,
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
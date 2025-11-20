// --- Supabase Client Initialization ---
import { supabase } from '../utils/supabaseClient.js';

// ------------------------------------ Password toggle ------------------------------------
function togglePassword(fieldId) {
  const passwordField = document.getElementById(fieldId);
  const toggle = passwordField?.nextElementSibling;

  if (!passwordField || !toggle) return;

  if (passwordField.type === 'password') {
    passwordField.type = 'text';
    toggle.textContent = 'Hide';
  } else {
    passwordField.type = 'password';
    toggle.textContent = 'Show';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const signupForm = document.getElementById('signupForm');
  const message = document.getElementById('message');
  const passwordToggles = document.querySelectorAll('.password-toggle');
  const termsLink = document.getElementById('termsLink');
  const termsModal = document.getElementById('termsModal');
  const termsOverlay = document.getElementById('termsOverlay');
  const closeTermsModal = document.getElementById('closeTermsModal');
  const termsCheckboxEl = document.getElementById('termsCheckbox');
  let lastFocusedElement = null;

  passwordToggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
      const targetFieldId = toggle.dataset.target;
      if (targetFieldId) {
        togglePassword(targetFieldId);
      }
    });
  });

  // ------------------------------------ Terms & Conditions Modal ------------------------------------
  function openTermsModal() {
    if (!termsModal) return;
    lastFocusedElement = document.activeElement;
    termsModal.classList.add('open');
    termsModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (closeTermsModal) {
      closeTermsModal.focus();
    } else {
      termsModal.focus();
    }
  }

  function closeTerms() {
    if (!termsModal) return;
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    } else if (termsLink && typeof termsLink.focus === 'function') {
      termsLink.focus();
    }

    termsModal.classList.remove('open');
    termsModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (termsCheckboxEl) {
      termsCheckboxEl.checked = true;
      termsCheckboxEl.dispatchEvent(new Event('change'));
    }
  }

  if (termsLink) {
    termsLink.addEventListener('click', (e) => {
      e.preventDefault();
      openTermsModal();
    });
  }
  if (termsOverlay) termsOverlay.addEventListener('click', closeTerms);
  if (closeTermsModal) closeTermsModal.addEventListener('click', closeTerms);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTerms(); });

  if (termsCheckboxEl) {
    termsCheckboxEl.addEventListener('click', (e) => {
      if (!termsCheckboxEl.checked) {
        e.preventDefault();
        openTermsModal();
      }
    });
  }

  // ------------------------------------ Admin Signup Logic ------------------------------------
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (message) {
        message.textContent = '';
        message.style.color = '';
      }

      const firstName = document.getElementById('firstName')?.value.trim();
      const lastName = document.getElementById('lastName')?.value.trim();
      const fullName = `${firstName || ''} ${lastName || ''}`.trim();
      const email = document.getElementById('email')?.value.trim();
      const password = document.getElementById('password')?.value.trim();
      const confirmPassword = document.getElementById('confirmPassword')?.value.trim();

      if (!firstName || !lastName || !email || !password || !confirmPassword) {
        message.textContent = 'Please fill in all required fields.';
        message.style.color = 'red';
        return;
      }

      if (password !== confirmPassword) {
        message.textContent = 'Passwords do not match.';
        message.style.color = 'red';
        return;
      }

      if (!termsCheckboxEl?.checked) {
        message.textContent = 'You must agree to the privacy and policy.';
        message.style.color = 'red';
        return;
      }

      const passwordRequirements = /^(?=.*[A-Z])(?=.*[_!@#$%^&*(),.?":{}|<>]).{8,}$/;
      if (!passwordRequirements.test(password)) {
        message.textContent = 'Password must be at least 8 characters long, contain 1 uppercase letter, and 1 symbol.';
        message.style.color = 'red';
        return;
      }

      message.textContent = 'Signing up...';
      message.style.color = 'blue';

      try {
        const { error: signupError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName || ' ',
              last_name: lastName || ' ',
              role: 'admin'
            }
          }
        });

        if (signupError) {
          throw signupError;
        }

        message.textContent = '✅ Admin signup successful! Redirecting to login...';
        message.style.color = 'green';

        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } catch (err) {
        console.error('Admin signup failed:', err);
        message.textContent = `❌ Signup failed: ${err.message || 'Unexpected error.'}`;
        message.style.color = 'red';
      }
    });
  }
});

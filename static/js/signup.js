// --- Supabase Client Initialization ---
import { supabase } from '../utils/supabaseClient.js';

// ------------------------------------ Password eye Function ------------------------------------
function togglePassword(fieldId) {
  const passwordField = document.getElementById(fieldId);
  const toggle = passwordField.nextElementSibling;

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
  const navigateToLoginBtn = document.getElementById('navigateToLoginBtn');
  const passwordToggles = document.querySelectorAll('.password-toggle');
  const termsLink = document.getElementById('termsLink');
  const termsModal = document.getElementById('termsModal');
  const termsOverlay = document.getElementById('termsOverlay');
  const closeTermsModal = document.getElementById('closeTermsModal');
  const termsCheckboxEl = document.getElementById('termsCheckbox');

  // ------------------------------------ Navigate to Login Button ------------------------------------
  if (navigateToLoginBtn) {
    navigateToLoginBtn.addEventListener('click', () => {
      window.location.href = 'login.html';
    });
  }

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
    termsModal.classList.add('open');
    termsModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeTerms() {
    if (!termsModal) return;
    termsModal.classList.remove('open');
    termsModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    // Mark the checkbox as agreed upon closing the modal
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
  if (termsOverlay) {
    termsOverlay.addEventListener('click', closeTerms);
  }
  if (closeTermsModal) {
    closeTermsModal.addEventListener('click', closeTerms);
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeTerms();
  });

  // Intercept checkbox click to require viewing modal first
  if (termsCheckboxEl) {
    termsCheckboxEl.addEventListener('click', (e) => {
      // If user is trying to check it (current state is unchecked), open modal first
      if (!termsCheckboxEl.checked) {
        e.preventDefault();
        openTermsModal();
      }
      // Allow unchecking without modal
    });
  }

  // ------------------------------------ Signup Form ------------------------------------
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // ✅ Define variables properly
      const firstName = document.getElementById('firstName').value.trim();
      const lastName = document.getElementById('lastName').value.trim();
      const fullName = `${firstName} ${lastName}`;
      const gender = document.getElementById('gender').value;
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value.trim();
      const confirmPassword = document.getElementById('confirmPassword').value.trim();
      const termsCheckbox = document.getElementById('termsCheckbox');
      const username = document.getElementById('username').value.trim();

      // ------------------------------------ Checks if all required fields are filled ------------------------------------
      if (!firstName || !lastName || !gender || !email || !password || !confirmPassword || !username) {
        message.textContent = 'Please fill in all required fields.';
        message.style.color = 'red';
        return;
      }

      // ------------------------------------ password and confirm password fields match ------------------------------------
      if (password !== confirmPassword) {
        message.textContent = 'Passwords do not match.';
        message.style.color = 'red';
        return;
      }

      // ------------------------------------ privacy and policy terms ------------------------------------
      if (!termsCheckbox.checked) {
        message.textContent = 'You must agree to the privacy and policy.';
        message.style.color = 'red';
        return;
      }

      // ------------------------------------ Password Strength Validation ------------------------------------
      const passwordRequirements = /^(?=.*[A-Z])(?=.*[_!@#$%^&*(),.?":{}|<>]).{8,}$/;
      if (!passwordRequirements.test(password)) {
        message.textContent = 'Password must be at least 8 characters long, contain 1 uppercase letter, and 1 symbol.';
        message.style.color = 'red';
        return;
      }

      // ------------------------------------ Display "Signing Up" Message ------------------------------------
      message.textContent = 'Signing up....';
      message.style.color = 'blue';

      // ------------------------------------ Supabase User Registration (Sign Up) ------------------------------------
      const { data: existingUserData, error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            full_name: fullName,
            gender: gender,
            username: username
          }
        }
      });

      // ------------------------------------ Signup Error Handling ------------------------------------
      if (signupError) {
        message.textContent = `❌ Signup failed: ${signupError.message}`;
        message.style.color = 'red';
        return;
      }

      if (!existingUserData || !existingUserData.user) {
        message.textContent = '❌ Signup failed: Unexpected error.';
        message.style.color = 'red';
        return;
      }

      // ✅ Success (no need for manual insert because your DB trigger should handle it)
      message.textContent = '✅ Signup successful! Please check your email. Redirecting...';
      message.style.color = 'green';

      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    });
  }
});

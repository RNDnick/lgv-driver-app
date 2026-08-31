import * as backend from './backend.js';
import { APP_VERSION } from './version.js';

export function renderAuth(root, { onAuthed } = {}) {
  let mode = 'signin';

  function render() {
    root.innerHTML = `
      <div class="screen">
        <h1>SafeCouple</h1>
        <h2>${mode === 'signin' ? 'Sign In' : 'Create Account'}</h2>
        ${mode === 'signup' ? `
        <label class="field"><span>Full name</span><input id="fullName" type="text" autocomplete="name" /></label>` : ''}
        <label class="field"><span>Email</span><input id="email" type="email" autocomplete="email" /></label>
        <label class="field"><span>Password</span><input id="password" type="password" autocomplete="${mode === 'signin' ? 'current-password' : 'new-password'}" /></label>
        <p id="authError" class="error" style="display:none"></p>
        <button id="submitBtn" class="btn-primary btn-large">${mode === 'signin' ? 'Sign In' : 'Sign Up'}</button>
        <button id="toggleBtn" class="btn-secondary">${mode === 'signin' ? 'Need an account? Sign Up' : 'Have an account? Sign In'}</button>
        <p class="muted small version-tag">v${APP_VERSION}</p>
      </div>
    `;
    root.querySelector('#toggleBtn').onclick = () => {
      mode = mode === 'signin' ? 'signup' : 'signin';
      render();
    };
    root.querySelector('#submitBtn').onclick = async () => {
      const email = root.querySelector('#email').value.trim();
      const password = root.querySelector('#password').value;
      const errEl = root.querySelector('#authError');
      errEl.style.display = 'none';
      try {
        if (mode === 'signin') {
          await backend.signIn(email, password);
          onAuthed && onAuthed();
        } else {
          const fullName = root.querySelector('#fullName').value.trim();
          const { session } = await backend.signUp(email, password, fullName);
          if (session) {
            onAuthed && onAuthed();
          } else {
            renderCheckEmail(email);
          }
        }
      } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
      }
    };
  }

  function renderCheckEmail(email) {
    root.innerHTML = `
      <div class="screen">
        <h1>SafeCouple</h1>
        <h2>Check your email</h2>
        <p class="instruction">We've sent a confirmation link to ${email}. Follow it, then come back and sign in.</p>
        <button id="backBtn" class="btn-primary btn-large">Back to Sign In</button>
      </div>
    `;
    root.querySelector('#backBtn').onclick = () => {
      mode = 'signin';
      render();
    };
  }

  render();
}

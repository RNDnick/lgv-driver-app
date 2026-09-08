import * as backend from './backend.js';
import { APP_VERSION } from './version.js';

export function renderAuth(root, { onAuthed } = {}) {
  let mode = 'signin';
  let showSignInForm = false;

  function signInFieldsHtml() {
    return `
      <label class="field"><span>Email</span><input id="email" type="email" autocomplete="email" /></label>
      <label class="field"><span>Password</span><input id="password" type="password" autocomplete="current-password" /></label>
      <p id="authError" class="error" style="display:none"></p>
      <button id="submitBtn" class="btn-primary btn-large">Sign In</button>
    `;
  }

  // A returning driver wants the form fast, without scrolling past the pitch
  // - a small link at the top expands it in place. A first-time visitor
  // (including Google's crawler) sees the pitch first; Sign Up sits below
  // "How it works" since that's the point someone new has enough context to
  // decide to create an account.
  function renderSignIn() {
    root.innerHTML = `
      <div class="screen">
        <div class="landing-header">
          <h1 class="landing-title"><img src="icons/icon-192.png" class="landing-logo" alt="" />SafeCouple</h1>
          <button id="signInLinkBtn" class="btn-link landing-signin-link">${showSignInForm ? 'Hide' : 'Sign In'}</button>
        </div>
        ${showSignInForm ? signInFieldsHtml() : ''}

        <p class="tagline">Photo-verified trailer coupling &amp; uncoupling checks for LGV drivers.</p>
        <p class="instruction">Paper checklists get lost, get skipped, or get filled in after the fact.
          SafeCouple gives every coupling and uncoupling a timestamped photo record instead —
          automatically, on the driver's own phone, with no paperwork.</p>

        <h3>How it works</h3>
        <div class="landing-steps">
          <div class="landing-step"><span class="landing-step-num">1</span><span>Pick Standard or Close Coupling/Uncoupling</span></div>
          <div class="landing-step"><span class="landing-step-num">2</span><span>Follow the steps in order — Kingpin, Clip, Airlines, Legs, Brake</span></div>
          <div class="landing-step"><span class="landing-step-num">3</span><span>Snap a photo at each step — timestamped automatically</span></div>
          <div class="landing-step"><span class="landing-step-num">4</span><span>Done — saved instantly, even offline, and synced once you're back in signal</span></div>
        </div>

        <button id="toggleBtn" class="btn-secondary">Need an account? Sign Up</button>

        <h3>What's included</h3>
        <div class="home-grid">
          <div class="tile">
            <span class="tile-icon">🔗</span>
            <span>Guided Checklists</span>
            <span class="tile-sub">Matched to your own safety process</span>
          </div>
          <div class="tile">
            <span class="tile-icon">📷</span>
            <span>Photo Evidence</span>
            <span class="tile-sub">Timestamped proof at every step</span>
          </div>
          <div class="tile">
            <span class="tile-icon">📶</span>
            <span>Works Offline</span>
            <span class="tile-sub">Saves instantly, syncs later</span>
          </div>
          <div class="tile">
            <span class="tile-icon">📋</span>
            <span>Job &amp; Delivery Log</span>
            <span class="tile-sub">Mileage &amp; proof-of-delivery photos</span>
          </div>
          <div class="tile">
            <span class="tile-icon">📊</span>
            <span>Manager Oversight</span>
            <span class="tile-sub">Every driver's checks, one place</span>
          </div>
        </div>

        <h3>Who it's for</h3>
        <p class="instruction landing-tight-heading">Used by drivers to record every trailer coupling and
          uncoupling with photo evidence — replacing paper checklists with a reliable,
          timestamped digital record.</p>

        <p class="muted small version-tag landing-footer-tag">v${APP_VERSION}<br>Built by RND Tech.</p>
      </div>
    `;
    root.querySelector('#signInLinkBtn').onclick = () => {
      showSignInForm = !showSignInForm;
      renderSignIn();
    };
    root.querySelector('#toggleBtn').onclick = () => {
      mode = 'signup';
      showSignInForm = false;
      renderSignUp();
    };
    if (showSignInForm) {
      root.querySelector('#submitBtn').onclick = async () => {
        const email = root.querySelector('#email').value.trim();
        const password = root.querySelector('#password').value;
        const errEl = root.querySelector('#authError');
        errEl.style.display = 'none';
        try {
          await backend.signIn(email, password);
          onAuthed && onAuthed();
        } catch (err) {
          errEl.textContent = err.message;
          errEl.style.display = 'block';
        }
      };
    }
  }

  function renderSignUp() {
    root.innerHTML = `
      <div class="screen">
        <h1>SafeCouple</h1>
        <h2>Create Account</h2>
        <label class="field"><span>Full name</span><input id="fullName" type="text" autocomplete="name" /></label>
        <label class="field"><span>Email</span><input id="email" type="email" autocomplete="email" /></label>
        <label class="field"><span>Password</span><input id="password" type="password" autocomplete="new-password" /></label>
        <p id="authError" class="error" style="display:none"></p>
        <button id="submitBtn" class="btn-primary btn-large">Sign Up</button>
        <button id="toggleBtn" class="btn-secondary">Have an account? Sign In</button>
        <p class="muted small version-tag">v${APP_VERSION}</p>
      </div>
    `;
    root.querySelector('#toggleBtn').onclick = () => {
      mode = 'signin';
      renderSignIn();
    };
    root.querySelector('#submitBtn').onclick = async () => {
      const email = root.querySelector('#email').value.trim();
      const password = root.querySelector('#password').value;
      const fullName = root.querySelector('#fullName').value.trim();
      const errEl = root.querySelector('#authError');
      errEl.style.display = 'none';
      try {
        const { session } = await backend.signUp(email, password, fullName);
        if (session) {
          onAuthed && onAuthed();
        } else {
          renderCheckEmail(email);
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
      renderSignIn();
    };
  }

  renderSignIn();
}

import * as backend from './backend.js';
import { APP_VERSION } from './version.js';
import { getSteps, getLabel } from './checklists-data.js';

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
        <p class="muted small landing-tight-heading">Click below to learn more.</p>
        <div class="home-grid">
          <button class="tile" id="exampleChecklistBtn">
            <span class="tile-icon">🔗</span>
            <span>Guided Checklists</span>
            <span class="tile-sub">Matched to your own safety process</span>
          </button>
          <button class="tile" id="examplePhotosBtn">
            <span class="tile-icon">📷</span>
            <span>Photo Evidence</span>
            <span class="tile-sub">Timestamped proof at every step</span>
          </button>
          <div class="tile">
            <span class="tile-icon">📶</span>
            <span>Works Offline</span>
            <span class="tile-sub">Saves instantly, syncs later</span>
          </div>
          <button class="tile" id="exampleJobLogBtn">
            <span class="tile-icon">📋</span>
            <span>Job &amp; Delivery Log</span>
            <span class="tile-sub">Mileage &amp; proof-of-delivery photos</span>
          </button>
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
    root.querySelector('#exampleChecklistBtn').onclick = () => {
      // Pushed so the hardware/browser back button returns here rather than
      // exiting the page - app.js's global popstate handler doesn't know
      // about this pre-login state, but since it re-checks the session and
      // finds none for ANY unrecognised view, it falls through to showAuth(),
      // which is exactly "back to the landing page" anyway.
      history.pushState({ view: 'example-checklist' }, '');
      renderExampleChecklist();
    };
    root.querySelector('#examplePhotosBtn').onclick = () => {
      history.pushState({ view: 'example-photos' }, '');
      renderExamplePhotos();
    };
    root.querySelector('#exampleJobLogBtn').onclick = () => {
      history.pushState({ view: 'example-joblog' }, '');
      renderExampleJobLog();
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

  // A no-login preview of the real checklist flow's content (steps and
  // instructions only - no camera, no saving) so a visitor can see what
  // "guided checklist" actually means before creating an account.
  function renderExampleChecklist() {
    const steps = getSteps('connect');
    root.innerHTML = `
      <div class="screen">
        <h2>Example: ${getLabel('connect')}</h2>
        <p class="muted small">A preview of what a driver sees for each step.</p>
        <div class="list">
          ${steps.map((s, i) => `
            <div class="list-item">
              <div class="list-item-main">
                <strong>Step ${i + 1} of ${steps.length}: ${s.key} — ${s.title}</strong>
                <p class="instruction">${s.instruction}</p>
              </div>
            </div>
          `).join('')}
        </div>
        <p class="muted small">Each step also captures a timestamped photo as evidence, synced automatically once you're signed in.</p>
        <button id="backBtn" class="btn-secondary">Back</button>
      </div>
    `;
    root.querySelector('#backBtn').onclick = () => history.back();
  }

  // Real photos from a real completed checklist (with the actual times those
  // steps were done composited on, matching what the timestamp feature now
  // does automatically) - shown here as static assets rather than fetched
  // live, since the storage bucket these actually live in is private and
  // RLS-protected, and a visitor here has no session to read it with anyway.
  const EXAMPLE_PHOTOS = [
    { key: 'K', title: 'Kingpin', file: 'kingpin.jpg' },
    { key: 'C', title: 'Dog Clip', file: 'dog-clip.jpg' },
    { key: 'A', title: 'Airlines', file: 'airlines.jpg' },
    { key: 'L', title: 'Legs', file: 'legs.jpg' },
    { key: 'B', title: 'Brake', file: 'brake.jpg' },
  ];

  function renderExamplePhotos() {
    root.innerHTML = `
      <div class="screen">
        <h2>Example: Photo Evidence</h2>
        <p class="muted small">Real photos from a completed Standard Trailer Coupling, each with the time that step was actually done.</p>
        <div class="list">
          ${EXAMPLE_PHOTOS.map(p => `
            <div class="list-item">
              <div class="list-item-main">
                <strong>${p.key} — ${p.title}</strong>
                <img class="photo-preview" src="assets/examples/${p.file}" alt="Example ${p.title} photo" />
              </div>
            </div>
          `).join('')}
        </div>
        <button id="backBtn" class="btn-secondary">Back</button>
      </div>
    `;
    root.querySelector('#backBtn').onclick = () => history.back();
  }

  // Made-up entries, not real jobs - unlike the checklist/photo examples,
  // real job records carry actual customer names and delivery sites, which
  // is business information, not something to publish just to show the UI.
  const EXAMPLE_JOBS = [
    {
      customer: 'Example Manufacturing Ltd', status: 'open',
      collectionSite: 'Leeds Depot', deliverySite: 'Sheffield DC',
      date: 'Today, 09:15', trailerReg: 'AB12 CDE',
      mileageStart: 48213, mileageEnd: null,
      notes: 'Call ahead on arrival, use the side gate.',
    },
    {
      customer: 'Sample Retail Group', status: 'complete',
      collectionSite: 'Manchester Hub', deliverySite: 'Preston Store',
      date: 'Yesterday, 14:20', trailerReg: 'CD34 EFG',
      mileageStart: 52890, mileageEnd: 53040,
      notes: 'Left with warehouse manager, signed for.',
    },
  ];

  function renderExampleJobLog() {
    root.innerHTML = `
      <div class="screen">
        <h2>Example: Job &amp; Delivery Log</h2>
        <p class="muted small">Made-up jobs, showing the format - tap one to see the full detail.</p>
        <div class="list">
          ${EXAMPLE_JOBS.map((j, i) => `
            <div class="list-item" data-index="${i}">
              <div class="list-item-main">
                <strong>${j.customer}</strong>
                <span class="badge ${j.status}">${j.status}</span>
                <div class="muted">${j.collectionSite} → ${j.deliverySite}</div>
                <div class="muted small">${j.date} · ${j.trailerReg}</div>
              </div>
            </div>
          `).join('')}
        </div>
        <button id="backBtn" class="btn-secondary">Back</button>
      </div>
    `;
    root.querySelectorAll('.list-item').forEach(el => {
      // Not pushed onto history like the outer tile navigation - this whole
      // example page is already a single history entry (see
      // #exampleJobLogBtn's handler), and app.js's global popstate listener
      // doesn't know this pre-login sub-navigation exists, so a second
      // pushed level here would get collapsed straight back to the landing
      // page instead of to this list. Simple in-place swap avoids that.
      el.onclick = () => renderExampleJobDetail(EXAMPLE_JOBS[Number(el.dataset.index)]);
    });
    root.querySelector('#backBtn').onclick = () => history.back();
  }

  function renderExampleJobDetail(job) {
    root.innerHTML = `
      <div class="screen">
        <h2>${job.customer}</h2>
        <span class="badge ${job.status}">${job.status}</span>
        <p class="muted">${job.collectionSite} → ${job.deliverySite}</p>
        <p class="muted small">${job.date} · ${job.trailerReg}</p>
        <p>Mileage start: ${job.mileageStart}${job.mileageEnd ? ' · end: ' + job.mileageEnd : ''}</p>
        <p>${job.notes}</p>
        ${job.status === 'complete' ? '<p class="muted small">A real delivery also has a timestamped proof-of-delivery photo here.</p>' : ''}
        <button id="backBtn" class="btn-secondary">Back</button>
      </div>
    `;
    root.querySelector('#backBtn').onclick = () => renderExampleJobLog();
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

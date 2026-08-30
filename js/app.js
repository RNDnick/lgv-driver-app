import { renderChecklistFlow } from './checklist-view.js';
import { renderJobLog } from './joblog-view.js';
import { renderHistory } from './history-view.js';
import { renderAuth } from './auth-view.js';
import * as backend from './backend.js';
import * as sync from './sync.js';
import { getLabel } from './checklists-data.js';
import { APP_VERSION } from './version.js';

const RECENT_CHECKLISTS_COUNT = 5;

const root = document.getElementById('app-root');
let cleanup = null;

function fmtDate(ts) {
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Every top-level view (Home, Connect, Disconnect, Job Log, History) is only
// ever reached directly from Home, so the browser's previous history entry is
// always Home - that's what lets onExit just call history.back() below rather
// than needing to track a full navigation stack ourselves.
function go(view, params = {}) {
  history.pushState({ view, params }, '');
  renderView(view, params);
}

async function renderView(view, params = {}) {
  const session = await backend.getSession();
  if (!session) { showAuth(); return; }

  if (cleanup) { cleanup(); cleanup = null; }
  try {
    if (view === 'home') return await renderHome();
    if (view === 'connect') return (cleanup = await renderChecklistFlow(root, 'connect', { onExit: () => history.back() }));
    if (view === 'disconnect') return (cleanup = await renderChecklistFlow(root, 'disconnect', { onExit: () => history.back() }));
    if (view === 'joblog') return await renderJobLog(root, { onExit: () => history.back() });
    if (view === 'history') return await renderHistory(root, { onExit: () => history.back(), initialRecordId: params.recordId });
  } catch (err) {
    root.innerHTML = `
      <div class="screen">
        <h2>Something went wrong</h2>
        <p class="error">${err.message}</p>
        <button id="retryBtn" class="btn-primary btn-large">Retry</button>
      </div>
    `;
    root.querySelector('#retryBtn').onclick = () => renderView(view, params);
  }
}

function showAuth() {
  renderAuth(root, { onAuthed: () => resetToHome() });
}

function resetToHome() {
  history.replaceState({ view: 'home', params: {} }, '');
  renderView('home');
}

async function renderHome() {
  const [jobs, checklists, pendingCount] = await Promise.all([
    sync.getMergedJobs(),
    sync.getMergedChecklists(),
    sync.getPendingCount(),
  ]);
  const openJobs = jobs.filter(j => j.status === 'open').length;
  const recent = checklists.slice(0, RECENT_CHECKLISTS_COUNT);

  root.innerHTML = `
    <div class="screen">
      <div class="home-header">
        <h1>Trailer Uncouple/Couple</h1>
        <button id="logoutBtn" class="btn-link">Log out</button>
      </div>
      ${pendingCount ? `<p class="pending-badge">${pendingCount} record${pendingCount > 1 ? 's' : ''} waiting to sync</p>` : ''}
      <div class="home-grid">
        <button class="tile tile-connect" id="connectBtn">
          <span class="tile-icon">🔗</span>
          <span>Connect Trailer</span>
          <span class="tile-sub">K · C · A · L · B</span>
        </button>
        <button class="tile tile-disconnect" id="disconnectBtn">
          <span class="tile-icon">⛓️‍💥</span>
          <span>Drop Trailer</span>
          <span class="tile-sub">B · L · A · C · K</span>
        </button>
        <button class="tile" id="joblogBtn">
          <span class="tile-icon">📋</span>
          <span>Job Log</span>
          <span class="tile-sub">${openJobs} open</span>
        </button>
        <button class="tile" id="historyBtn">
          <span class="tile-icon">🕒</span>
          <span>History</span>
        </button>
      </div>
      ${recent.length ? `
      <h3>Recent checklists</h3>
      <div class="list">
        ${recent.map(r => `
          <div class="list-item" data-id="${r.id}">
            <div class="list-item-main">
              <strong>${getLabel(r.type)}</strong>
              ${r.pending ? '<span class="badge pending">Pending sync</span>' : ''}
              <div class="muted small">${r.trailerReg || 'No reg'} · ${fmtDate(r.completedAt)}</div>
            </div>
          </div>
        `).join('')}
      </div>` : ''}
      <p class="muted small version-tag">v${APP_VERSION}</p>
    </div>
  `;
  root.querySelector('#connectBtn').onclick = () => go('connect');
  root.querySelector('#disconnectBtn').onclick = () => go('disconnect');
  root.querySelector('#joblogBtn').onclick = () => go('joblog');
  root.querySelector('#historyBtn').onclick = () => go('history');
  root.querySelector('#logoutBtn').onclick = () => backend.signOut();
  root.querySelectorAll('.list-item').forEach(el => {
    el.onclick = () => go('history', { recordId: el.dataset.id });
  });
}

async function boot() {
  const session = await backend.getSession();
  if (session) {
    resetToHome();
  } else {
    showAuth();
  }
}

backend.onAuthChange(session => {
  if (session) {
    resetToHome();
  } else {
    showAuth();
  }
});

window.addEventListener('popstate', event => {
  const state = event.state || { view: 'home', params: {} };
  renderView(state.view, state.params);
});

boot();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

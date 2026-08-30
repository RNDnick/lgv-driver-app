import { renderChecklistFlow } from './checklist-view.js';
import { renderJobLog } from './joblog-view.js';
import { renderHistory } from './history-view.js';
import { renderAuth } from './auth-view.js';
import * as backend from './backend.js';
import * as sync from './sync.js';
import { getLabel } from './checklists-data.js';

const root = document.getElementById('app-root');
let cleanup = null;

function fmtDate(ts) {
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

async function go(view) {
  if (cleanup) { cleanup(); cleanup = null; }
  try {
    if (view === 'home') return await renderHome();
    if (view === 'connect') return (cleanup = await renderChecklistFlow(root, 'connect', { onExit: () => go('home') }));
    if (view === 'disconnect') return (cleanup = await renderChecklistFlow(root, 'disconnect', { onExit: () => go('home') }));
    if (view === 'joblog') return await renderJobLog(root, { onExit: () => go('home') });
    if (view === 'history') return await renderHistory(root, { onExit: () => go('home') });
  } catch (err) {
    root.innerHTML = `
      <div class="screen">
        <h2>Something went wrong</h2>
        <p class="error">${err.message}</p>
        <button id="retryBtn" class="btn-primary btn-large">Retry</button>
      </div>
    `;
    root.querySelector('#retryBtn').onclick = () => go(view);
  }
}

function showAuth() {
  renderAuth(root, { onAuthed: () => go('home') });
}

async function renderHome() {
  const [jobs, checklists, pendingCount] = await Promise.all([
    sync.getMergedJobs(),
    sync.getMergedChecklists(),
    sync.getPendingCount(),
  ]);
  const openJobs = jobs.filter(j => j.status === 'open').length;
  const recent = checklists.slice(0, 3);

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
          <div class="list-item">
            <div class="list-item-main">
              <strong>${getLabel(r.type)}</strong>
              ${r.pending ? '<span class="badge pending">Pending sync</span>' : ''}
              <div class="muted small">${r.trailerReg || 'No reg'} · ${fmtDate(r.completedAt)}</div>
            </div>
          </div>
        `).join('')}
      </div>` : ''}
    </div>
  `;
  root.querySelector('#connectBtn').onclick = () => go('connect');
  root.querySelector('#disconnectBtn').onclick = () => go('disconnect');
  root.querySelector('#joblogBtn').onclick = () => go('joblog');
  root.querySelector('#historyBtn').onclick = () => go('history');
  root.querySelector('#logoutBtn').onclick = () => backend.signOut();
}

async function boot() {
  const session = await backend.getSession();
  if (session) {
    go('home');
  } else {
    showAuth();
  }
}

backend.onAuthChange(session => {
  if (session) {
    go('home');
  } else {
    showAuth();
  }
});

boot();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

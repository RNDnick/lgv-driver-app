import { renderChecklistFlow } from './checklist-view.js';
import { renderJobLog } from './joblog-view.js';
import { renderHistory } from './history-view.js';
import { dbGetAll } from './db.js';
import { getLabel } from './checklists-data.js';

const root = document.getElementById('app-root');
let cleanup = null;

function fmtDate(ts) {
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

async function go(view) {
  if (cleanup) { cleanup(); cleanup = null; }
  if (view === 'home') return renderHome();
  if (view === 'connect') return (cleanup = await renderChecklistFlow(root, 'connect', { onExit: () => go('home') }));
  if (view === 'disconnect') return (cleanup = await renderChecklistFlow(root, 'disconnect', { onExit: () => go('home') }));
  if (view === 'joblog') return renderJobLog(root, { onExit: () => go('home') });
  if (view === 'history') return renderHistory(root, { onExit: () => go('home') });
}

async function renderHome() {
  const [jobs, checklists] = await Promise.all([dbGetAll('jobs'), dbGetAll('checklists')]);
  const openJobs = jobs.filter(j => j.status === 'open').length;
  const recent = checklists.sort((a, b) => b.completedAt - a.completedAt).slice(0, 3);

  root.innerHTML = `
    <div class="screen">
      <h1>Trailer Uncouple/Couple</h1>
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
}

go('home');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

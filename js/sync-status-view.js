import * as sync from './sync.js';
import { getLabel } from './checklists-data.js';

function fmtDate(ts) {
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function describeEntry(entry) {
  if (entry.kind === 'checklist') {
    return `${getLabel(entry.payload.type)} · ${entry.payload.trailerReg || 'No reg'}`;
  }
  if (entry.kind === 'job') {
    const label = entry.payload.status === 'complete' ? 'Delivery' : 'New job';
    return `${entry.payload.customer || 'Untitled job'} · ${label}`;
  }
  return entry.kind;
}

export function renderSyncStatus(root, { onExit } = {}) {
  async function render() {
    const entries = await sync.getAllPending();
    root.innerHTML = `
      <div class="screen">
        <h2>Sync Status</h2>
        ${entries.length === 0 ? `
          <p class="muted">Everything is synced — nothing waiting.</p>
        ` : `
          <p class="instruction">${entries.length} record${entries.length > 1 ? 's' : ''} waiting to sync.</p>
          <div class="list">
            ${entries.map(e => `
              <div class="list-item">
                <div class="list-item-main">
                  <strong>${describeEntry(e)}</strong>
                  <div class="muted small">Created ${fmtDate(e.createdAt)} · ${e.attempts} attempt${e.attempts === 1 ? '' : 's'}</div>
                  ${e.lastError
                    ? `<p class="error">${e.lastError}</p>`
                    : '<p class="muted small">Not attempted yet — will retry automatically once you have a signal.</p>'}
                </div>
              </div>
            `).join('')}
          </div>
        `}
        <button id="syncNowBtn" class="btn-primary btn-large">Sync Now</button>
        <button id="backBtn" class="btn-secondary">Back</button>
      </div>
    `;
    root.querySelector('#syncNowBtn').onclick = async () => {
      const btn = root.querySelector('#syncNowBtn');
      btn.disabled = true;
      btn.textContent = 'Syncing…';
      await sync.flushOutbox();
      render();
    };
    root.querySelector('#backBtn').onclick = () => onExit && onExit();
  }

  render();
}

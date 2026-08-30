import { dbGetAll } from './db.js';
import { getLabel } from './checklists-data.js';

function fmtDate(ts) {
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export async function renderHistory(root, { onExit } = {}) {
  const records = (await dbGetAll('checklists')).sort((a, b) => b.completedAt - a.completedAt);

  function renderList() {
    root.innerHTML = `
      <div class="screen">
        <h2>Checklist History</h2>
        <div class="list">
          ${records.length === 0 ? '<p class="muted">No checklist records yet.</p>' : records.map(r => `
            <div class="list-item" data-id="${r.id}">
              <div class="list-item-main">
                <strong>${getLabel(r.type)}</strong>
                <div class="muted">${r.trailerReg || 'No trailer reg'}</div>
                <div class="muted small">${fmtDate(r.completedAt)}</div>
              </div>
            </div>
          `).join('')}
        </div>
        <button id="backBtn" class="btn-secondary">Back</button>
      </div>
    `;
    root.querySelectorAll('.list-item').forEach(el => {
      el.onclick = () => renderDetail(records.find(r => r.id === el.dataset.id));
    });
    root.querySelector('#backBtn').onclick = () => onExit && onExit();
  }

  function renderDetail(record) {
    root.innerHTML = `
      <div class="screen">
        <h2>${getLabel(record.type)}</h2>
        <p class="muted">${record.trailerReg || 'No trailer reg'} · ${fmtDate(record.completedAt)}</p>
        <div class="thumb-grid">
          ${record.steps.map(s => `
            <div class="thumb">
              <img src="${URL.createObjectURL(s.photo)}" alt="${s.title}" />
              <span>${s.key} · ${s.title}</span>
            </div>
          `).join('')}
        </div>
        <button id="backBtn" class="btn-secondary">Back</button>
      </div>
    `;
    root.querySelector('#backBtn').onclick = () => renderList();
  }

  renderList();
}

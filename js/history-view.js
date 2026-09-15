import * as sync from './sync.js';
import * as backend from './backend.js';
import { getLabel } from './checklists-data.js';
import { createSubRouter } from './subrouter.js';
import { openLightbox, handleLightboxPop } from './lightbox.js';

function fmtDate(ts) {
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export async function renderHistory(root, { onExit, initialRecordId } = {}) {
  const [checklists, walkarounds] = await Promise.all([
    sync.getMergedChecklists(),
    sync.getMergedWalkaroundChecks(),
  ]);
  const records = [
    ...checklists.map(r => ({ ...r, _kind: 'checklist' })),
    ...walkarounds.map(r => ({ ...r, _kind: 'walkaround' })),
  ].sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
  const sub = createSubRouter('history');

  function renderList() {
    root.innerHTML = `
      <div class="screen">
        <h2>History</h2>
        <div class="list">
          ${records.length === 0 ? '<p class="muted">No records yet.</p>' : records.map(r => `
            <div class="list-item" data-id="${r.id}">
              <div class="list-item-main">
                <strong>${r._kind === 'walkaround' ? 'Daily Walkaround Check' : getLabel(r.type)}</strong>
                ${r.pending ? '<span class="badge pending">Pending sync</span>' : ''}
                <div class="muted">${(r._kind === 'walkaround' ? r.vehicleReg : r.trailerReg) || 'No reg'}</div>
                <div class="muted small">${fmtDate(r.completedAt)}</div>
              </div>
            </div>
          `).join('')}
        </div>
        <button id="backBtn" class="btn-secondary">Back</button>
      </div>
    `;
    root.querySelectorAll('.list-item').forEach(el => {
      el.onclick = () => {
        sub.push({ screen: 'detail', id: el.dataset.id });
        renderDetail(records.find(r => r.id === el.dataset.id));
      };
    });
    root.querySelector('#backBtn').onclick = () => onExit && onExit();
  }

  async function renderChecklistDetail(record) {
    const stepPhotoUrls = await Promise.all(record.steps.map(async s => {
      if (record.pending && record._photos && record._photos[s.key]) {
        return URL.createObjectURL(record._photos[s.key]);
      }
      if (s.photoPath) {
        return backend.getPhotoUrl(s.photoPath);
      }
      return null;
    }));
    root.innerHTML = `
      <div class="screen">
        <h2>${getLabel(record.type)}</h2>
        ${record.pending ? '<span class="badge pending">Pending sync</span>' : ''}
        <p class="muted">${record.trailerReg || 'No trailer reg'} · ${fmtDate(record.completedAt)}</p>
        <div class="thumb-grid">
          ${record.steps.map((s, i) => `
            <div class="thumb">
              <img src="${stepPhotoUrls[i] || ''}" alt="${s.title}" data-index="${i}" />
              <span>${s.key} · ${s.title}</span>
            </div>
          `).join('')}
        </div>
        <button id="backBtn" class="btn-secondary">Back</button>
      </div>
    `;
    root.querySelectorAll('.thumb img').forEach(img => {
      if (!img.src) return;
      img.onclick = () => {
        const i = Number(img.dataset.index);
        openLightbox(sub, { screen: 'detail', id: record.id }, stepPhotoUrls[i], record.steps[i].title);
      };
    });
    root.querySelector('#backBtn').onclick = () => history.back();
  }

  async function renderWalkaroundDetail(record) {
    const defects = record.items.filter(i => i.status === 'defect');
    const defectPhotoUrls = await Promise.all(defects.map(async i => {
      if (record.pending && record._photos && record._photos[i.key]) {
        return URL.createObjectURL(record._photos[i.key]);
      }
      if (i.photoPath) {
        return backend.getPhotoUrl(i.photoPath);
      }
      return null;
    }));
    root.innerHTML = `
      <div class="screen">
        <h2>Daily Walkaround Check</h2>
        ${record.pending ? '<span class="badge pending">Pending sync</span>' : ''}
        <p class="muted">${record.vehicleReg || 'No vehicle reg'} · ${fmtDate(record.completedAt)}</p>
        <div class="list">
          ${record.items.map(i => `
            <div class="list-item">
              <div class="list-item-main">
                <strong>${i.label}</strong>
                ${i.status === 'defect' ? `<p class="error small">Defect: ${i.description}</p>` : '<span class="muted small">Pass</span>'}
              </div>
            </div>
          `).join('')}
        </div>
        ${defects.length ? `
        <h3>Defect photos</h3>
        <div class="thumb-grid">
          ${defects.map((d, i) => `
            <div class="thumb">
              <img src="${defectPhotoUrls[i] || ''}" alt="${d.label}" data-index="${i}" />
              <span>${d.label}</span>
            </div>
          `).join('')}
        </div>` : ''}
        <button id="backBtn" class="btn-secondary">Back</button>
      </div>
    `;
    root.querySelectorAll('.thumb img').forEach(img => {
      if (!img.src) return;
      img.onclick = () => {
        const i = Number(img.dataset.index);
        openLightbox(sub, { screen: 'detail', id: record.id }, defectPhotoUrls[i], defects[i].label);
      };
    });
    root.querySelector('#backBtn').onclick = () => history.back();
  }

  function renderDetail(record) {
    return record._kind === 'walkaround' ? renderWalkaroundDetail(record) : renderChecklistDetail(record);
  }

  sub.onPop(screen => {
    if (handleLightboxPop(screen)) return;
    if (screen && screen.screen === 'detail') {
      const record = records.find(r => r.id === screen.id);
      if (record) return renderDetail(record);
    }
    renderList();
  });

  if (initialRecordId && records.find(r => r.id === initialRecordId)) {
    sub.push({ screen: 'detail', id: initialRecordId });
    renderDetail(records.find(r => r.id === initialRecordId));
  } else {
    renderList();
  }

  return () => sub.destroy();
}

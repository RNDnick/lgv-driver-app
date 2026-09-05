import * as backend from './backend.js';
import { getLabel } from './checklists-data.js';
import { createSubRouter } from './subrouter.js';
import { openLightbox, handleLightboxPop } from './lightbox.js';
import { escapeHtml } from './util.js';

function fmtDate(ts) {
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Read-only across every driver's data - a manager can look, but editing or
// deleting someone else's record belongs to that driver's own History/Job
// Log, not here.
export async function renderManagerDashboard(root, { onExit } = {}) {
  const sub = createSubRouter('manager');
  const [checklists, jobs, feedback] = await Promise.all([
    backend.getAllChecklistsForManager(),
    backend.getAllJobsForManager(),
    backend.getAllFeedback(),
  ]);

  function renderList() {
    root.innerHTML = `
      <div class="screen">
        <h2>Manager Dashboard</h2>
        <h3>Checklists</h3>
        <div class="list">
          ${checklists.length === 0 ? '<p class="muted">No checklist records yet.</p>' : checklists.map(r => `
            <div class="list-item" data-kind="checklist" data-id="${r.id}">
              <div class="list-item-main">
                <strong>${getLabel(r.type)}</strong>
                <div class="muted">${escapeHtml(r.driverName)} · ${escapeHtml(r.trailerReg || 'No reg')}</div>
                <div class="muted small">${fmtDate(r.completedAt)}</div>
              </div>
            </div>
          `).join('')}
        </div>
        <h3>Jobs</h3>
        <div class="list">
          ${jobs.length === 0 ? '<p class="muted">No jobs logged yet.</p>' : jobs.map(j => `
            <div class="list-item" data-kind="job" data-id="${j.id}">
              <div class="list-item-main">
                <strong>${escapeHtml(j.customer || 'Untitled job')}</strong>
                <span class="badge ${j.status}">${j.status}</span>
                <div class="muted">${escapeHtml(j.driverName)} · ${escapeHtml(j.collectionSite || '—')} → ${escapeHtml(j.deliverySite || '—')}</div>
                <div class="muted small">${fmtDate(j.createdAt)}${j.trailerReg ? ' · ' + escapeHtml(j.trailerReg) : ''}</div>
              </div>
            </div>
          `).join('')}
        </div>
        <h3>Feedback</h3>
        <div class="list">
          ${feedback.length === 0 ? '<p class="muted">Nothing submitted yet.</p>' : feedback.map(f => `
            <div class="list-item">
              <div class="list-item-main">
                <strong>${escapeHtml(f.driverName)}</strong>
                <div class="muted small">${fmtDate(f.createdAt)}</div>
                <p class="instruction">${escapeHtml(f.message)}</p>
              </div>
            </div>
          `).join('')}
        </div>
        <button id="backBtn" class="btn-secondary">Back</button>
      </div>
    `;
    root.querySelectorAll('.list-item[data-kind="checklist"]').forEach(el => {
      el.onclick = () => {
        sub.push({ screen: 'checklist', id: el.dataset.id });
        renderChecklistDetail(checklists.find(r => r.id === el.dataset.id));
      };
    });
    root.querySelectorAll('.list-item[data-kind="job"]').forEach(el => {
      el.onclick = () => {
        sub.push({ screen: 'job', id: el.dataset.id });
        renderJobDetail(jobs.find(j => j.id === el.dataset.id));
      };
    });
    root.querySelector('#backBtn').onclick = () => onExit && onExit();
  }

  async function renderChecklistDetail(record) {
    const stepPhotoUrls = await Promise.all(
      record.steps.map(s => (s.photoPath ? backend.getPhotoUrl(s.photoPath) : null))
    );
    root.innerHTML = `
      <div class="screen">
        <h2>${getLabel(record.type)}</h2>
        <p class="muted">${escapeHtml(record.driverName)} · ${escapeHtml(record.trailerReg || 'No trailer reg')} · ${fmtDate(record.completedAt)}</p>
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
        openLightbox(sub, { screen: 'checklist', id: record.id }, stepPhotoUrls[i], record.steps[i].title);
      };
    });
    root.querySelector('#backBtn').onclick = () => history.back();
  }

  async function renderJobDetail(job) {
    const photoUrl = job.podPhotoPath ? await backend.getPhotoUrl(job.podPhotoPath) : null;
    root.innerHTML = `
      <div class="screen">
        <h2>${escapeHtml(job.customer || 'Job')}</h2>
        <span class="badge ${job.status}">${job.status}</span>
        <p class="muted">${escapeHtml(job.driverName)}</p>
        <p class="muted">${escapeHtml(job.collectionSite || '—')} → ${escapeHtml(job.deliverySite || '—')}</p>
        <p class="muted small">Created ${fmtDate(job.createdAt)}${job.trailerReg ? ' · ' + escapeHtml(job.trailerReg) : ''}</p>
        ${job.mileageStart ? `<p>Mileage start: ${job.mileageStart}${job.mileageEnd ? ' · end: ' + job.mileageEnd : ''}</p>` : ''}
        ${job.notes ? `<p>${escapeHtml(job.notes)}</p>` : ''}
        ${photoUrl ? `<img class="photo-preview" src="${photoUrl}" alt="Proof of delivery" />` : ''}
        <button id="backBtn" class="btn-secondary">Back</button>
      </div>
    `;
    if (photoUrl) {
      root.querySelector('.photo-preview').onclick = () => {
        openLightbox(sub, { screen: 'job', id: job.id }, photoUrl, 'Proof of delivery');
      };
    }
    root.querySelector('#backBtn').onclick = () => history.back();
  }

  sub.onPop(screen => {
    if (handleLightboxPop(screen)) return;
    if (screen && screen.screen === 'checklist') {
      const record = checklists.find(r => r.id === screen.id);
      if (record) return renderChecklistDetail(record);
    }
    if (screen && screen.screen === 'job') {
      const job = jobs.find(j => j.id === screen.id);
      if (job) return renderJobDetail(job);
    }
    renderList();
  });

  renderList();
  return () => sub.destroy();
}

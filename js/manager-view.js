import * as backend from './backend.js';
import { getLabel } from './checklists-data.js';
import { createSubRouter } from './subrouter.js';
import { openLightbox, handleLightboxPop } from './lightbox.js';
import { escapeHtml } from './util.js';

function fmtDate(ts) {
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// [driverName, items[]] pairs, alphabetical by name - items keep whatever
// order they arrived in (the backend already sorts each list newest-first),
// so a driver's own group stays newest-first too.
function groupByDriver(items) {
  const map = new Map();
  for (const item of items) {
    if (!map.has(item.driverName)) map.set(item.driverName, []);
    map.get(item.driverName).push(item);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function checklistItemHtml(r) {
  return `
    <div class="list-item" data-kind="checklist" data-id="${r.id}">
      <div class="list-item-main">
        <strong>${getLabel(r.type)}</strong>
        <div class="muted">${escapeHtml(r.trailerReg || 'No reg')}</div>
        <div class="muted small">${fmtDate(r.completedAt)}</div>
      </div>
    </div>
  `;
}

function jobItemHtml(j) {
  return `
    <div class="list-item" data-kind="job" data-id="${j.id}">
      <div class="list-item-main">
        <strong>${escapeHtml(j.customer || 'Untitled job')}</strong>
        <span class="badge ${j.status}">${j.status}</span>
        <div class="muted">${escapeHtml(j.collectionSite || '—')} → ${escapeHtml(j.deliverySite || '—')}</div>
        <div class="muted small">${fmtDate(j.createdAt)}${j.trailerReg ? ' · ' + escapeHtml(j.trailerReg) : ''}</div>
      </div>
    </div>
  `;
}

function feedbackItemHtml(f) {
  return `
    <div class="list-item">
      <div class="list-item-main">
        <div class="muted small">${fmtDate(f.createdAt)}</div>
        <p class="instruction">${escapeHtml(f.message)}</p>
      </div>
    </div>
  `;
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

  // Persists across a drill-in/back round trip within this screen (the
  // manager searched "Kurt", tapped a record, hit back - they'd expect to
  // still be looking at "Kurt" on return, not a reset search box).
  let searchQuery = '';

  function sectionHtml(title, items, itemHtml, emptyText) {
    const query = searchQuery.trim().toLowerCase();
    const groups = groupByDriver(items).filter(([name]) => !query || name.toLowerCase().includes(query));
    if (!groups.length) {
      return `<h3>${title}</h3><p class="muted">${query ? 'No matching drivers.' : emptyText}</p>`;
    }
    return `
      <h3>${title}</h3>
      ${groups.map(([driverName, groupItems]) => `
        <div class="driver-group-heading">${escapeHtml(driverName)}</div>
        <div class="list">${groupItems.map(itemHtml).join('')}</div>
      `).join('')}
    `;
  }

  function wireItemClickHandlers() {
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
  }

  // Only rebuilds the results container, not the search input itself, so
  // typing doesn't lose focus/cursor position on every keystroke.
  function renderSections() {
    root.querySelector('#dashboardSections').innerHTML = `
      ${sectionHtml('Checklists', checklists, checklistItemHtml, 'No checklist records yet.')}
      ${sectionHtml('Jobs', jobs, jobItemHtml, 'No jobs logged yet.')}
      ${sectionHtml('Feedback', feedback, feedbackItemHtml, 'Nothing submitted yet.')}
    `;
    wireItemClickHandlers();
  }

  function renderShell() {
    root.innerHTML = `
      <div class="screen">
        <h2>Manager Dashboard</h2>
        <label class="field">
          <span>Search by driver name</span>
          <input id="driverSearch" type="text" placeholder="e.g. Kurt" value="${escapeHtml(searchQuery)}" />
        </label>
        <div id="dashboardSections"></div>
        <button id="backBtn" class="btn-secondary">Back</button>
      </div>
    `;
    root.querySelector('#driverSearch').addEventListener('input', e => {
      searchQuery = e.target.value;
      renderSections();
    });
    root.querySelector('#backBtn').onclick = () => onExit && onExit();
    renderSections();
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
    renderShell();
  });

  renderShell();
  return () => sub.destroy();
}

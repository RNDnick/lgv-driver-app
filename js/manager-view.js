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

function walkaroundItemHtml(r) {
  const defectCount = r.items.filter(i => i.status === 'defect').length;
  return `
    <div class="list-item" data-kind="walkaround" data-id="${r.id}">
      <div class="list-item-main">
        <strong>Daily Walkaround Check</strong>
        ${defectCount ? `<span class="badge open">${defectCount} defect${defectCount > 1 ? 's' : ''}</span>` : '<span class="badge complete">all clear</span>'}
        <div class="muted">${escapeHtml(r.vehicleReg || 'No reg')}</div>
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

const DEFECT_BADGE = { open: 'open', acknowledged: 'pending', resolved: 'complete' };

function defectItemHtml(d) {
  return `
    <div class="list-item" data-kind="defect" data-id="${d.id}">
      <div class="list-item-main">
        <strong>${escapeHtml(d.itemLabel)}</strong>
        <span class="badge ${DEFECT_BADGE[d.status]}">${d.status}</span>
        <div class="muted">${escapeHtml(d.vehicleReg || 'No reg')}</div>
        <div class="muted small">${fmtDate(d.createdAt)}</div>
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
  const [checklists, walkarounds, jobs, feedback, defectsRaw] = await Promise.all([
    backend.getAllChecklistsForManager(),
    backend.getAllWalkaroundChecksForManager(),
    backend.getAllJobsForManager(),
    backend.getAllFeedback(),
    backend.getAllDefectsForManager(),
  ]);
  // Open defects are the ones needing attention, so they're surfaced first
  // within each driver's group - already sorted newest-first by the backend
  // within that.
  const statusRank = { open: 0, acknowledged: 1, resolved: 2 };
  const defects = [...defectsRaw].sort((a, b) => statusRank[a.status] - statusRank[b.status]);

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
    root.querySelectorAll('.list-item[data-kind="walkaround"]').forEach(el => {
      el.onclick = () => {
        sub.push({ screen: 'walkaround', id: el.dataset.id });
        renderWalkaroundDetail(walkarounds.find(r => r.id === el.dataset.id));
      };
    });
    root.querySelectorAll('.list-item[data-kind="job"]').forEach(el => {
      el.onclick = () => {
        sub.push({ screen: 'job', id: el.dataset.id });
        renderJobDetail(jobs.find(j => j.id === el.dataset.id));
      };
    });
    root.querySelectorAll('.list-item[data-kind="defect"]').forEach(el => {
      el.onclick = () => {
        sub.push({ screen: 'defect', id: el.dataset.id });
        renderDefectDetail(defects.find(d => d.id === el.dataset.id));
      };
    });
  }

  // Only rebuilds the results container, not the search input itself, so
  // typing doesn't lose focus/cursor position on every keystroke.
  function renderSections() {
    root.querySelector('#dashboardSections').innerHTML = `
      ${sectionHtml('Defects', defects, defectItemHtml, 'No defects reported yet.')}
      ${sectionHtml('Checklists', checklists, checklistItemHtml, 'No checklist records yet.')}
      ${sectionHtml('Walkaround Checks', walkarounds, walkaroundItemHtml, 'No walkaround checks yet.')}
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

  async function renderWalkaroundDetail(record) {
    const defectItems = record.items.filter(i => i.status === 'defect');
    const defectPhotoUrls = await Promise.all(
      defectItems.map(i => (i.photoPath ? backend.getPhotoUrl(i.photoPath) : null))
    );
    root.innerHTML = `
      <div class="screen">
        <h2>Daily Walkaround Check</h2>
        <p class="muted">${escapeHtml(record.driverName)} · ${escapeHtml(record.vehicleReg || 'No vehicle reg')} · ${fmtDate(record.completedAt)}</p>
        <div class="list">
          ${record.items.map(i => `
            <div class="list-item">
              <div class="list-item-main">
                <strong>${escapeHtml(i.label)}</strong>
                ${i.status === 'defect' ? `<p class="error small">Defect: ${escapeHtml(i.description)}</p>` : '<span class="muted small">Pass</span>'}
              </div>
            </div>
          `).join('')}
        </div>
        ${defectItems.length ? `
        <h3>Defect photos</h3>
        <div class="thumb-grid">
          ${defectItems.map((d, i) => `
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
        openLightbox(sub, { screen: 'walkaround', id: record.id }, defectPhotoUrls[i], defectItems[i].label);
      };
    });
    root.querySelector('#backBtn').onclick = () => history.back();
  }

  // Mutates `record` in place on Acknowledge/Resolve - it's the same object
  // held in the shared `defects` array, so going back to the list (which
  // re-renders from that array) picks up the new status without a re-fetch.
  async function renderDefectDetail(record) {
    const photoUrl = record.photoPath ? await backend.getPhotoUrl(record.photoPath) : null;
    let resolving = false;

    function draw() {
      root.innerHTML = `
        <div class="screen">
          <h2>${escapeHtml(record.itemLabel)}</h2>
          <span class="badge ${DEFECT_BADGE[record.status]}">${record.status}</span>
          <p class="muted">${escapeHtml(record.driverName)} · ${escapeHtml(record.vehicleReg || 'No reg')} · ${fmtDate(record.createdAt)}</p>
          <p>${escapeHtml(record.description)}</p>
          ${photoUrl ? `<img class="photo-preview" id="defectPhoto" src="${photoUrl}" alt="${escapeHtml(record.itemLabel)}" />` : ''}
          ${record.status === 'resolved' ? `<p class="muted small">Resolved ${fmtDate(record.resolvedAt)}${record.resolvedNotes ? ' · ' + escapeHtml(record.resolvedNotes) : ''}</p>` : ''}
          ${record.status === 'open' ? '<button id="ackBtn" class="btn-primary btn-large">Acknowledge</button>' : ''}
          ${record.status !== 'resolved' && !resolving ? '<button id="resolveBtn" class="btn-secondary">Resolve</button>' : ''}
          ${resolving ? `
            <label class="field">
              <span>Resolution notes (optional)</span>
              <textarea id="resolveNotes" rows="3" placeholder="What was done about it"></textarea>
            </label>
            <button id="confirmResolveBtn" class="btn-primary btn-large">✔ Confirm Resolved</button>
            <button id="cancelResolveBtn" class="btn-secondary">Cancel</button>
          ` : ''}
          <button id="backBtn" class="btn-secondary">Back</button>
        </div>
      `;
      if (photoUrl) {
        root.querySelector('#defectPhoto').onclick = () => {
          openLightbox(sub, { screen: 'defect', id: record.id }, photoUrl, record.itemLabel);
        };
      }
      const ackBtn = root.querySelector('#ackBtn');
      if (ackBtn) ackBtn.onclick = async () => {
        ackBtn.disabled = true;
        await backend.updateDefectStatus(record.id, 'acknowledged');
        record.status = 'acknowledged';
        record.acknowledgedAt = Date.now();
        draw();
      };
      const resolveBtn = root.querySelector('#resolveBtn');
      if (resolveBtn) resolveBtn.onclick = () => { resolving = true; draw(); };
      const cancelResolveBtn = root.querySelector('#cancelResolveBtn');
      if (cancelResolveBtn) cancelResolveBtn.onclick = () => { resolving = false; draw(); };
      const confirmResolveBtn = root.querySelector('#confirmResolveBtn');
      if (confirmResolveBtn) confirmResolveBtn.onclick = async event => {
        const btn = event.currentTarget;
        if (btn.disabled) return;
        btn.disabled = true;
        btn.textContent = 'Saving…';
        const notes = root.querySelector('#resolveNotes').value.trim();
        await backend.updateDefectStatus(record.id, 'resolved', notes);
        record.status = 'resolved';
        record.resolvedAt = Date.now();
        record.resolvedNotes = notes || null;
        resolving = false;
        draw();
      };
      root.querySelector('#backBtn').onclick = () => history.back();
    }
    draw();
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
    if (screen && screen.screen === 'walkaround') {
      const record = walkarounds.find(r => r.id === screen.id);
      if (record) return renderWalkaroundDetail(record);
    }
    if (screen && screen.screen === 'job') {
      const job = jobs.find(j => j.id === screen.id);
      if (job) return renderJobDetail(job);
    }
    if (screen && screen.screen === 'defect') {
      const record = defects.find(d => d.id === screen.id);
      if (record) return renderDefectDetail(record);
    }
    renderShell();
  });

  renderShell();
  return () => sub.destroy();
}

import { newId, dbGet, dbPut, dbDelete } from './db.js';
import * as sync from './sync.js';
import * as backend from './backend.js';
import { startCamera, stopCamera, captureFrame, wireTorchButton } from './camera.js';
import { hashBlob, isNearDuplicate } from './photo-hash.js';
import { createSubRouter } from './subrouter.js';

const FORM_DRAFT_ID = 'draft-job-form';
const FORM_FIELDS = ['customer', 'collectionSite', 'deliverySite', 'trailerReg', 'mileageStart', 'notes'];

function fmtDate(ts) {
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export async function renderJobLog(root, { onExit } = {}) {
  const sub = createSubRouter('joblog');
  let activeScreen = { screen: null };
  let skipNextGuard = false;
  let hasCapturedPod = false;

  async function findJob(id) {
    return (await sync.getMergedJobs()).find(j => j.id === id);
  }

  function hasFormData() {
    return FORM_FIELDS.some(id => (root.querySelector('#' + id)?.value || '').trim() !== '');
  }

  // The New Job form has no intermediate checkpoint like the checklist flow
  // does - nothing was saved until the final Save Job click, so a screen
  // lock discarding the page mid-form lost everything typed. Checkpoint to
  // IndexedDB as the driver types (debounced) so a reload can restore it.
  async function saveFormDraft() {
    const draft = { id: FORM_DRAFT_ID, updatedAt: Date.now() };
    for (const id of FORM_FIELDS) draft[id] = root.querySelector('#' + id)?.value.trim() || '';
    if (FORM_FIELDS.some(id => draft[id])) {
      await dbPut('drafts', draft);
    } else {
      await dbDelete('drafts', FORM_DRAFT_ID);
    }
  }

  let formDraftTimer = null;
  function scheduleFormDraftSave() {
    clearTimeout(formDraftTimer);
    formDraftTimer = setTimeout(saveFormDraft, 400);
  }

  function hasCompleteProgress() {
    const mileageInput = root.querySelector('#mileageEnd');
    return hasCapturedPod || (mileageInput && mileageInput.value.trim() !== '');
  }

  async function renderList() {
    activeScreen = { screen: null };
    const [jobs, formDraft] = await Promise.all([sync.getMergedJobs(), dbGet('drafts', FORM_DRAFT_ID)]);
    root.innerHTML = `
      <div class="screen">
        <h2>Job &amp; Delivery Log</h2>
        ${formDraft ? `
        <p class="pending-badge">
          Unsaved new job from ${fmtDate(formDraft.updatedAt)}${formDraft.customer ? ` (${formDraft.customer})` : ''}.
          <button id="resumeFormBtn" class="btn-link">Resume</button> ·
          <button id="discardFormBtn" class="btn-link">Discard</button>
        </p>` : ''}
        <button id="newJobBtn" class="btn-primary btn-large">+ New Job</button>
        <div class="list">
          ${jobs.length === 0 ? '<p class="muted">No jobs logged yet.</p>' : jobs.map(j => `
            <div class="list-item" data-id="${j.id}">
              <div class="list-item-main">
                <strong>${j.customer || 'Untitled job'}</strong>
                <span class="badge ${j.status}">${j.status}</span>
                ${j.pending ? '<span class="badge pending">Pending sync</span>' : ''}
                <div class="muted">${j.collectionSite || '—'} → ${j.deliverySite || '—'}</div>
                <div class="muted small">${fmtDate(j.createdAt)}${j.trailerReg ? ' · ' + j.trailerReg : ''}</div>
              </div>
            </div>
          `).join('')}
        </div>
        <button id="backBtn" class="btn-secondary">Back</button>
      </div>
    `;
    root.querySelector('#newJobBtn').onclick = () => {
      sub.push({ screen: 'form' });
      renderForm();
    };
    if (formDraft) {
      root.querySelector('#resumeFormBtn').onclick = () => {
        sub.push({ screen: 'form' });
        renderForm(formDraft);
      };
      root.querySelector('#discardFormBtn').onclick = async () => {
        await dbDelete('drafts', FORM_DRAFT_ID);
        renderList();
      };
    }
    root.querySelectorAll('.list-item').forEach(el => {
      el.onclick = () => {
        sub.push({ screen: 'detail', id: el.dataset.id });
        renderDetail(jobs.find(j => j.id === el.dataset.id));
      };
    });
    root.querySelector('#backBtn').onclick = () => onExit && onExit();
  }

  function renderForm(draft) {
    activeScreen = { screen: 'form' };
    root.innerHTML = `
      <div class="screen">
        <h2>New Job</h2>
        <label class="field"><span>Customer / Site name</span><input id="customer" type="text" value="${draft?.customer || ''}" /></label>
        <label class="field"><span>Collection site</span><input id="collectionSite" type="text" value="${draft?.collectionSite || ''}" /></label>
        <label class="field"><span>Delivery site</span><input id="deliverySite" type="text" value="${draft?.deliverySite || ''}" /></label>
        <label class="field"><span>Trailer registration</span><input id="trailerReg" type="text" value="${draft?.trailerReg || ''}" /></label>
        <p id="formError" class="error" style="display:none">Trailer registration is required.</p>
        <label class="field"><span>Mileage at start</span><input id="mileageStart" type="number" inputmode="numeric" value="${draft?.mileageStart || ''}" /></label>
        <label class="field"><span>Notes</span><textarea id="notes" rows="3">${draft?.notes || ''}</textarea></label>
        <button id="saveBtn" class="btn-primary btn-large">Save Job</button>
        <button id="cancelBtn" class="btn-secondary">Cancel</button>
      </div>
    `;
    FORM_FIELDS.forEach(id => root.querySelector('#' + id)?.addEventListener('input', scheduleFormDraftSave));
    root.querySelector('#saveBtn').onclick = async () => {
      const trailerReg = root.querySelector('#trailerReg').value.trim();
      if (!trailerReg) {
        root.querySelector('#formError').style.display = 'block';
        return;
      }
      const job = {
        id: newId(),
        status: 'open',
        createdAt: Date.now(),
        customer: root.querySelector('#customer').value.trim(),
        collectionSite: root.querySelector('#collectionSite').value.trim(),
        deliverySite: root.querySelector('#deliverySite').value.trim(),
        trailerReg,
        mileageStart: root.querySelector('#mileageStart').value || null,
        mileageEnd: null,
        notes: root.querySelector('#notes').value.trim(),
        podPhotoPath: null,
        completedAt: null,
      };
      await sync.enqueue('job', job, {});
      await dbDelete('drafts', FORM_DRAFT_ID);
      skipNextGuard = true;
      history.back();
    };
    root.querySelector('#cancelBtn').onclick = async () => {
      if (hasFormData() && !window.confirm('Discard this new job? The details you entered will be lost.')) return;
      await dbDelete('drafts', FORM_DRAFT_ID);
      skipNextGuard = true;
      history.back();
    };
  }

  async function renderDetail(job) {
    activeScreen = { screen: 'detail', id: job.id };
    let photoUrl = null;
    if (job.pending && job._photos && job._photos.pod) {
      photoUrl = URL.createObjectURL(job._photos.pod);
    } else if (job.podPhotoPath) {
      photoUrl = await backend.getPhotoUrl(job.podPhotoPath);
    }
    root.innerHTML = `
      <div class="screen">
        <h2>${job.customer || 'Job'}</h2>
        <span class="badge ${job.status}">${job.status}</span>
        ${job.pending ? '<span class="badge pending">Pending sync</span>' : ''}
        <p class="muted">${job.collectionSite || '—'} → ${job.deliverySite || '—'}</p>
        <p class="muted small">Created ${fmtDate(job.createdAt)}${job.trailerReg ? ' · ' + job.trailerReg : ''}</p>
        ${job.mileageStart ? `<p>Mileage start: ${job.mileageStart}${job.mileageEnd ? ' · end: ' + job.mileageEnd : ''}</p>` : ''}
        ${job.notes ? `<p>${job.notes}</p>` : ''}
        ${photoUrl ? `<img class="photo-preview" src="${photoUrl}" alt="Proof of delivery" />` : ''}
        ${job.status === 'open' ? '<button id="completeBtn" class="btn-primary btn-large">Mark Delivered (capture POD)</button>' : ''}
        <button id="deleteBtn" class="btn-secondary">Delete</button>
        <button id="backBtn" class="btn-secondary">Back</button>
      </div>
    `;
    if (job.status === 'open') {
      root.querySelector('#completeBtn').onclick = () => {
        sub.push({ screen: 'complete', id: job.id });
        renderComplete(job);
      };
    }
    root.querySelector('#deleteBtn').onclick = async () => {
      if (job.pending) {
        await sync.cancelPending(job.id);
      } else {
        await backend.deleteJob(job.id);
      }
      skipNextGuard = true;
      history.back();
    };
    root.querySelector('#backBtn').onclick = () => history.back();
  }

  async function renderComplete(job) {
    activeScreen = { screen: 'complete', id: job.id };
    hasCapturedPod = false;
    let stream = null;
    root.innerHTML = `
      <div class="screen">
        <h2>Proof of Delivery</h2>
        <label class="field"><span>Mileage at end</span><input id="mileageEnd" type="number" inputmode="numeric" /></label>
        <div class="camera-wrap">
          <video id="cam" playsinline autoplay muted class="camera-preview"></video>
          <button id="torchBtn" class="torch-btn" title="Toggle flash">🔦</button>
        </div>
        <p id="torchTip" class="warning" style="display:none">Your phone doesn't let apps control the flash directly. Swipe down from the top-right corner to open Control Centre and tap the flashlight icon, then come back and continue.</p>
        <button id="captureBtn" class="btn-primary btn-large">📷 Capture POD Photo</button>
        <button id="skipBtn" class="btn-secondary">Save Without Photo</button>
        <button id="cancelBtn" class="btn-secondary">Cancel</button>
      </div>
    `;
    const videoEl = root.querySelector('#cam');
    const captureBtn = root.querySelector('#captureBtn');
    const torchBtn = root.querySelector('#torchBtn');
    try {
      stream = await startCamera(videoEl);
      wireTorchButton(torchBtn, root.querySelector('#torchTip'), stream);
    } catch (err) {
      root.querySelector('.camera-preview').outerHTML = `<p class="error">Camera unavailable: ${err.message}</p>`;
      captureBtn.disabled = true;
      captureBtn.textContent = 'Camera unavailable';
      torchBtn.style.display = 'none';
    }
    async function finish(photo, photoHash, mileageEndValue) {
      const { pending, _photos, ...jobFields } = job;
      const updated = {
        ...jobFields,
        mileageEnd: mileageEndValue || null,
        status: 'complete',
        completedAt: Date.now(),
        podPhotoHash: photoHash || jobFields.podPhotoHash || null,
      };
      await sync.enqueue('job', updated, photo ? { pod: photo } : {});
      skipNextGuard = true;
      history.back();
    }

    async function renderPodReview(photo, mileageEndValue) {
      const url = URL.createObjectURL(photo);
      const photoHash = await hashBlob(photo);
      const priorHashes = await sync.getTodaysPodHashes();
      const isDuplicate = priorHashes.some(h => isNearDuplicate(h, photoHash));
      root.innerHTML = `
        <div class="screen">
          <h2>Proof of Delivery</h2>
          <img src="${url}" class="photo-preview" alt="Proof of delivery" />
          ${isDuplicate ? '<p class="warning">This looks very similar to another delivery photo already taken today. Make sure it\'s genuinely this delivery before confirming.</p>' : ''}
          <button id="confirmBtn" class="btn-primary btn-large">✔ Confirm</button>
          <button id="retakeBtn" class="btn-secondary">Retake</button>
        </div>
      `;
      root.querySelector('#confirmBtn').onclick = () => finish(photo, photoHash, mileageEndValue);
      root.querySelector('#retakeBtn').onclick = () => renderComplete(job);
    }

    captureBtn.onclick = async () => {
      const mileageEndValue = root.querySelector('#mileageEnd').value || null;
      const photo = await captureFrame(videoEl);
      hasCapturedPod = true;
      stopCamera(stream);
      renderPodReview(photo, mileageEndValue);
    };
    root.querySelector('#skipBtn').onclick = () => {
      const mileageEndValue = root.querySelector('#mileageEnd').value || null;
      stopCamera(stream);
      finish(null, null, mileageEndValue);
    };
    root.querySelector('#cancelBtn').onclick = () => {
      if (hasCompleteProgress() && !window.confirm('Discard this delivery photo and mileage?')) return;
      stopCamera(stream);
      skipNextGuard = true;
      history.back();
    };
  }

  sub.onPop(async screen => {
    const previous = activeScreen;
    if (!skipNextGuard) {
      if (previous.screen === 'form' && hasFormData() && !window.confirm('Discard this new job? The details you entered will be lost.')) {
        sub.push(previous);
        return;
      }
      if (previous.screen === 'complete' && hasCompleteProgress() && !window.confirm('Discard this delivery photo and mileage?')) {
        sub.push(previous);
        return;
      }
    }
    // Reaching here from 'form' means it's genuinely being left - either
    // empty, or the driver just confirmed discarding it - so the checkpoint
    // shouldn't linger and reappear as a stale "resume" offer next visit.
    if (previous.screen === 'form') {
      await dbDelete('drafts', FORM_DRAFT_ID);
    }
    skipNextGuard = false;
    if (screen && screen.screen === 'detail') {
      findJob(screen.id).then(job => (job ? renderDetail(job) : renderList()));
    } else if (screen && screen.screen === 'complete') {
      findJob(screen.id).then(job => (job ? renderComplete(job) : renderList()));
    } else if (screen && screen.screen === 'form') {
      renderForm();
    } else {
      renderList();
    }
  });

  renderList();

  return () => sub.destroy();
}

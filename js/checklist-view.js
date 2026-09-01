import { getSteps, getLabel } from './checklists-data.js';
import { startCamera, stopCamera, captureFrame, wireTorchButton, createZoomControl } from './camera.js';
import { newId, dbGet, dbPut, dbDelete } from './db.js';
import * as sync from './sync.js';
import { hashBlob, isNearDuplicate } from './photo-hash.js';
import { createSubRouter } from './subrouter.js';
import { setLeaveGuard, clearLeaveGuard } from './nav-guard.js';

function fmtDate(ts) {
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export async function renderChecklistFlow(root, type, { onExit } = {}) {
  const steps = getSteps(type);
  let trailerReg = '';
  let jobId = '';
  let stream = null;
  const captures = []; // confirmed steps only, in order: { key, title, completedAt, photo, photoHash }

  const openJobs = (await sync.getMergedJobs()).filter(j => j.status === 'open');
  const sub = createSubRouter(type);

  // A mobile screen locking often doesn't just pause the page - the OS can
  // discard it entirely under memory pressure, and the driver comes back to a
  // cold reload with everything that only lived in JS memory gone. Every
  // confirmed step is checkpointed to IndexedDB immediately (not just at the
  // final Save Record) under a stable per-type id, so a checklist in progress
  // survives that. Only committed (confirmed) steps are protected - the one
  // photo mid-capture when the screen locks can still be lost, a much smaller
  // loss than the whole checklist.
  const draftId = `draft-${type}`;

  setLeaveGuard(() => captures.length === 0 || window.confirm(
    `Discard this checklist? You've already captured ${captures.length} of ${steps.length} photos.`
  ));

  function cleanupCamera() {
    stopCamera(stream);
    stream = null;
  }

  async function saveDraft() {
    await dbPut('drafts', {
      id: draftId,
      type,
      trailerReg,
      jobId,
      startedAt: captures[0]?.completedAt || Date.now(),
      updatedAt: Date.now(),
      steps: captures,
    });
  }

  async function clearDraft() {
    await dbDelete('drafts', draftId);
  }

  // Current depth from Home = however many times this view has pushed a
  // history entry this session, plus app.js's one initial push into it. A
  // resumed draft jumps straight to its step without replaying one push per
  // already-confirmed step, so this can't be derived from the step index -
  // it has to be an actual running count of what this session pushed.
  let pushCount = 0;
  function push(screen) {
    pushCount += 1;
    sub.push(screen);
  }

  function renderResumePrompt(draft) {
    root.innerHTML = `
      <div class="screen">
        <h2>${getLabel(type)}</h2>
        <p class="instruction">You have an unfinished checklist from ${fmtDate(draft.updatedAt)}
          with ${draft.steps.length} of ${steps.length} photos already taken${draft.trailerReg ? ` for trailer ${draft.trailerReg}` : ''}.</p>
        <button id="resumeBtn" class="btn-primary btn-large">Resume</button>
        <button id="discardBtn" class="btn-secondary">Start Fresh (discard)</button>
      </div>
    `;
    root.querySelector('#resumeBtn').onclick = () => {
      trailerReg = draft.trailerReg;
      jobId = draft.jobId;
      captures.push(...draft.steps);
      // Replay one history entry per already-confirmed step, matching what
      // normal progression would have pushed, so back-navigation from the
      // resume point steps through those photos instead of jumping to setup.
      for (let i = 0; i <= captures.length; i++) {
        push({ index: i });
      }
      renderStepOrReview(captures.length);
    };
    root.querySelector('#discardBtn').onclick = async () => {
      await clearDraft();
      renderSetup();
    };
  }

  function renderSetup() {
    cleanupCamera();
    root.innerHTML = `
      <div class="screen">
        <h2>${getLabel(type)}</h2>
        <label class="field">
          <span>Trailer registration</span>
          <input id="trailerReg" type="text" placeholder="e.g. AB12 CDE" value="${trailerReg}" />
        </label>
        <p id="setupError" class="error" style="display:none">Trailer registration is required.</p>
        ${openJobs.length ? `
        <label class="field">
          <span>Link to job (optional)</span>
          <select id="jobSelect">
            <option value="">— None —</option>
            ${openJobs.map(j => `<option value="${j.id}">${j.customer || 'Job'} — ${j.deliverySite || j.collectionSite || ''}</option>`).join('')}
          </select>
        </label>` : ''}
        <button id="startBtn" class="btn-primary btn-large">Start</button>
        <button id="backBtn" class="btn-secondary">Cancel</button>
      </div>
    `;
    root.querySelector('#startBtn').onclick = () => {
      const value = root.querySelector('#trailerReg').value.trim();
      if (!value) {
        root.querySelector('#setupError').style.display = 'block';
        return;
      }
      trailerReg = value;
      const sel = root.querySelector('#jobSelect');
      jobId = sel ? sel.value : '';
      push({ index: 0 });
      renderStepOrReview(0);
    };
    root.querySelector('#backBtn').onclick = () => onExit && onExit();
  }

  function renderStepOrReview(index) {
    if (index >= steps.length) return renderSummary(index);
    if (index < captures.length) return renderReviewScreen(index, captures[index], true);
    return renderCameraScreen(index);
  }

  async function renderCameraScreen(index) {
    const step = steps[index];
    root.innerHTML = `
      <div class="screen">
        <div class="step-progress">Step ${index + 1} of ${steps.length}</div>
        <h2>${step.key} — ${step.title}</h2>
        <p class="instruction">${step.instruction}</p>
        <div class="camera-wrap">
          <video id="cam" playsinline autoplay muted class="camera-preview"></video>
          <button id="zoomBtn" class="zoom-btn" title="Zoom">1x</button>
          <button id="torchBtn" class="torch-btn" title="Toggle flash">🔦</button>
        </div>
        <p id="torchTip" class="warning" style="display:none">Your phone doesn't let apps control the flash directly. Swipe down from the top-right corner to open Control Centre and tap the flashlight icon, then come back and continue.</p>
        <button id="captureBtn" class="btn-primary btn-large">📷 Take Photo</button>
        <button id="backBtn" class="btn-secondary">Cancel</button>
      </div>
    `;
    const videoEl = root.querySelector('#cam');
    const captureBtn = root.querySelector('#captureBtn');
    const torchBtn = root.querySelector('#torchBtn');
    const zoomBtn = root.querySelector('#zoomBtn');
    let zoomControl = { getDigitalZoomLevel: () => 1 };
    try {
      stream = await startCamera(videoEl);
      wireTorchButton(torchBtn, root.querySelector('#torchTip'), stream);
      zoomControl = createZoomControl(zoomBtn, videoEl, stream);
    } catch (err) {
      root.querySelector('.camera-preview').outerHTML = `<p class="error">Camera unavailable: ${err.message}. Check your browser allows camera access (HTTPS or localhost required).</p>`;
      captureBtn.disabled = true;
      captureBtn.textContent = 'Camera unavailable';
      torchBtn.style.display = 'none';
      zoomBtn.style.display = 'none';
    }
    captureBtn.onclick = async () => {
      const photo = await captureFrame(videoEl, zoomControl.getDigitalZoomLevel());
      cleanupCamera();
      const photoHash = await hashBlob(photo);
      renderReviewScreen(index, { key: step.key, title: step.title, completedAt: Date.now(), photo, photoHash }, false);
    };
    root.querySelector('#backBtn').onclick = () => { cleanupCamera(); history.back(); };
  }

  async function renderReviewScreen(index, capture, isRedisplay) {
    const step = steps[index];
    const url = URL.createObjectURL(capture.photo);
    let warning = '';

    if (!isRedisplay) {
      // Kingpin, clip, airlines, legs and brake are physically distinct - any two
      // of them looking near-identical within the same checklist is a much
      // stronger signal than the cross-day check below, which only compares a
      // step against *other checklists'* photos for that same step.
      const withinChecklistMatch = captures.find(c => isNearDuplicate(c.photoHash, capture.photoHash));
      const priorHashes = await sync.getTodaysStepHashes(step.key);
      const isDuplicateAcrossDays = priorHashes.some(h => isNearDuplicate(h, capture.photoHash));
      if (withinChecklistMatch) {
        warning = `This looks like the same photo as your ${withinChecklistMatch.title} photo, already taken in this checklist. Each step needs its own genuine photo.`;
      } else if (isDuplicateAcrossDays) {
        warning = `This looks very similar to another ${step.title} photo already taken today. Make sure this is a genuinely new photo before confirming.`;
      }
    }

    root.innerHTML = `
      <div class="screen">
        <h2>${step.key} — ${step.title}</h2>
        <img src="${url}" class="photo-preview" alt="Captured evidence for ${step.title}" />
        ${warning ? `<p class="warning">${warning}</p>` : ''}
        <button id="confirmBtn" class="btn-primary btn-large">${isRedisplay ? '✔ Continue' : '✔ Confirm'}</button>
        <button id="retakeBtn" class="btn-secondary">Retake</button>
      </div>
    `;
    root.querySelector('#confirmBtn').onclick = async () => {
      captures[index] = capture;
      await saveDraft();
      const nextIndex = index + 1;
      push({ index: nextIndex });
      renderStepOrReview(nextIndex);
    };
    root.querySelector('#retakeBtn').onclick = () => renderCameraScreen(index);
  }

  function renderSummary(index) {
    root.innerHTML = `
      <div class="screen">
        <h2>${getLabel(type)} — Complete</h2>
        <p class="instruction">All ${captures.length} steps recorded with photo evidence.</p>
        <div class="thumb-grid">
          ${captures.map(c => `
            <div class="thumb">
              <img src="${URL.createObjectURL(c.photo)}" alt="${c.title}" />
              <span>${c.key} · ${c.title}</span>
            </div>
          `).join('')}
        </div>
        <button id="saveBtn" class="btn-primary btn-large">Save Record</button>
        <button id="discardBtn" class="btn-secondary">Discard</button>
      </div>
    `;
    root.querySelector('#saveBtn').onclick = async () => {
      const record = {
        id: newId(),
        type,
        trailerReg,
        jobId: jobId || null,
        startedAt: captures[0]?.completedAt || Date.now(),
        completedAt: Date.now(),
        steps: captures.map(c => ({ key: c.key, title: c.title, completedAt: c.completedAt, photoPath: null, photoHash: c.photoHash })),
      };
      const photos = Object.fromEntries(captures.map(c => [c.key, c.photo]));
      await sync.enqueue('checklist', record, photos);
      await clearDraft();
      clearLeaveGuard();
      history.go(-(pushCount + 1));
    };
    root.querySelector('#discardBtn').onclick = async () => {
      await clearDraft();
      clearLeaveGuard();
      history.go(-(pushCount + 1));
    };
  }

  sub.onPop(screen => {
    if (screen && typeof screen.index === 'number') {
      renderStepOrReview(screen.index);
    } else {
      renderSetup();
    }
  });

  const existingDraft = await dbGet('drafts', draftId);
  if (existingDraft && existingDraft.steps.length > 0) {
    renderResumePrompt(existingDraft);
  } else {
    renderSetup();
  }

  return () => {
    cleanupCamera();
    clearLeaveGuard();
    sub.destroy();
  };
}

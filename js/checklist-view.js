import { getSteps, getLabel } from './checklists-data.js';
import { startCamera, stopCamera, captureFrame } from './camera.js';
import { newId } from './db.js';
import * as sync from './sync.js';
import { hashBlob, isNearDuplicate } from './photo-hash.js';

export async function renderChecklistFlow(root, type, { onExit } = {}) {
  const steps = getSteps(type);
  let trailerReg = '';
  let jobId = '';
  let stepIndex = 0;
  let stream = null;
  const captures = []; // { key, title, completedAt, photo }

  const openJobs = (await sync.getMergedJobs()).filter(j => j.status === 'open');

  function cleanupCamera() {
    stopCamera(stream);
    stream = null;
  }

  function renderSetup() {
    cleanupCamera();
    root.innerHTML = `
      <div class="screen">
        <h2>${getLabel(type)}</h2>
        <label class="field">
          <span>Trailer registration (optional)</span>
          <input id="trailerReg" type="text" placeholder="e.g. AB12 CDE" value="${trailerReg}" />
        </label>
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
      trailerReg = root.querySelector('#trailerReg').value.trim();
      const sel = root.querySelector('#jobSelect');
      jobId = sel ? sel.value : '';
      stepIndex = 0;
      renderStep();
    };
    root.querySelector('#backBtn').onclick = () => onExit && onExit();
  }

  async function renderStep() {
    const step = steps[stepIndex];
    root.innerHTML = `
      <div class="screen">
        <div class="step-progress">Step ${stepIndex + 1} of ${steps.length}</div>
        <h2>${step.key} — ${step.title}</h2>
        <p class="instruction">${step.instruction}</p>
        <video id="cam" playsinline autoplay muted class="camera-preview"></video>
        <button id="captureBtn" class="btn-primary btn-large">📷 Take Photo</button>
        <button id="backBtn" class="btn-secondary">Cancel</button>
      </div>
    `;
    const videoEl = root.querySelector('#cam');
    const captureBtn = root.querySelector('#captureBtn');
    try {
      stream = await startCamera(videoEl);
    } catch (err) {
      root.querySelector('.camera-preview').outerHTML = `<p class="error">Camera unavailable: ${err.message}. Check your browser allows camera access (HTTPS or localhost required).</p>`;
      captureBtn.disabled = true;
      captureBtn.textContent = 'Camera unavailable';
    }
    captureBtn.onclick = async () => {
      const photo = await captureFrame(videoEl);
      cleanupCamera();
      renderReview(step, photo);
    };
    root.querySelector('#backBtn').onclick = () => { cleanupCamera(); onExit && onExit(); };
  }

  async function renderReview(step, photo) {
    const url = URL.createObjectURL(photo);
    const photoHash = await hashBlob(photo);
    const priorHashes = await sync.getTodaysStepHashes(step.key);
    const isDuplicate = priorHashes.some(h => isNearDuplicate(h, photoHash));
    root.innerHTML = `
      <div class="screen">
        <h2>${step.key} — ${step.title}</h2>
        <img src="${url}" class="photo-preview" alt="Captured evidence for ${step.title}" />
        ${isDuplicate ? `<p class="warning">This looks very similar to another ${step.title} photo already taken today. Make sure this is a genuinely new photo before confirming.</p>` : ''}
        <button id="confirmBtn" class="btn-primary btn-large">✔ Confirm</button>
        <button id="retakeBtn" class="btn-secondary">Retake</button>
      </div>
    `;
    root.querySelector('#confirmBtn').onclick = () => {
      captures.push({ key: step.key, title: step.title, completedAt: Date.now(), photo, photoHash });
      stepIndex += 1;
      if (stepIndex < steps.length) {
        renderStep();
      } else {
        renderSummary();
      }
    };
    root.querySelector('#retakeBtn').onclick = () => renderStep();
  }

  function renderSummary() {
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
      onExit && onExit();
    };
    root.querySelector('#discardBtn').onclick = () => onExit && onExit();
  }

  renderSetup();

  return () => cleanupCamera();
}

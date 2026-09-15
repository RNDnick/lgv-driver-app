import { getWalkaroundItems } from './walkaround-data.js';
import { startCamera, stopCamera, captureFrame, wireTorchButton, createZoomControl } from './camera.js';
import { newId, dbGet, dbPut, dbDelete } from './db.js';
import * as sync from './sync.js';
import { hashBlob, isNearDuplicate } from './photo-hash.js';
import { createSubRouter } from './subrouter.js';
import { setLeaveGuard, clearLeaveGuard } from './nav-guard.js';
import { openLightbox, handleLightboxPop } from './lightbox.js';

function fmtDate(ts) {
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const draftId = 'draft-walkaround';

export async function renderWalkaroundFlow(root, { onExit } = {}) {
  const itemDefs = getWalkaroundItems();
  let vehicleReg = '';
  let stream = null;
  // One entry per item, in the same order every time - unlike the coupling
  // checklist's captures array (which only grows as steps are confirmed),
  // this is fully pre-populated up front since items can be tackled in any
  // order, not sequentially.
  const items = itemDefs.map(def => ({
    ...def, status: null, description: null, photo: null, photoHash: null, completedAt: null,
  }));
  // Stable per-flow id - see the matching comment in checklist-view.js for
  // why this isn't generated fresh at Save time.
  const recordId = newId();

  const sub = createSubRouter('walkaround');

  setLeaveGuard(() => !hasProgress() || window.confirm(
    'Discard this walkaround check? Your progress on it will be lost.'
  ));

  function hasProgress() {
    return items.some(i => i.status);
  }

  function cleanupCamera() {
    stopCamera(stream);
    stream = null;
  }

  async function saveDraft() {
    await dbPut('drafts', {
      id: draftId,
      vehicleReg,
      startedAt: items.find(i => i.completedAt)?.completedAt || Date.now(),
      updatedAt: Date.now(),
      items: items.map(({ photo, ...rest }) => rest), // Blobs aren't structured-clone-safe across a reload anyway
    });
  }

  async function clearDraft() {
    await dbDelete('drafts', draftId);
  }

  // Each pushed screen records its own depth so popping back to it (however
  // many levels were actually traversed - a defect side-trip is 2 levels)
  // always restores the correct count for the final exit-to-Home jump,
  // without needing to track increments/decrements by hand.
  let pushCount = 0;
  function push(screen) {
    pushCount += 1;
    sub.push({ ...screen, depth: pushCount });
  }

  function exitToHome() {
    clearLeaveGuard();
    history.go(-(pushCount + 1));
  }

  function renderResumePrompt(draft) {
    root.innerHTML = `
      <div class="screen">
        <h2>Daily Walkaround Check</h2>
        <p class="instruction">You have an unfinished walkaround check from ${fmtDate(draft.updatedAt)}
          ${draft.vehicleReg ? `for vehicle ${draft.vehicleReg}` : ''}.</p>
        <button id="resumeBtn" class="btn-primary btn-large">Resume</button>
        <button id="discardBtn" class="btn-secondary">Start Fresh (discard)</button>
      </div>
    `;
    root.querySelector('#resumeBtn').onclick = () => {
      vehicleReg = draft.vehicleReg;
      // Photos for any already-confirmed defect can't survive a reload (see
      // saveDraft) - a resumed defect item goes back to "needs a fresh
      // photo" rather than silently keeping a broken/missing one.
      draft.items.forEach((saved, i) => {
        if (saved.status === 'defect' && !saved.photo) {
          items[i] = { ...items[i], status: null, description: null, completedAt: null };
        } else {
          items[i] = { ...items[i], ...saved };
        }
      });
      push({ screen: 'list' });
      renderList();
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
        <h2>Daily Walkaround Check</h2>
        <p class="muted small">Your legally-required pre-trip check - tyres, lights, brakes, fluid leaks,
          mirrors and more. Each item is a quick pass/fail; a defect needs a photo and a short description.</p>
        <label class="field">
          <span>Vehicle registration</span>
          <input id="vehicleReg" type="text" placeholder="e.g. AB12 CDE" value="${vehicleReg}" />
        </label>
        <p id="setupError" class="error" style="display:none">Vehicle registration is required.</p>
        <button id="startBtn" class="btn-primary btn-large">Start</button>
        <button id="backBtn" class="btn-secondary">Cancel</button>
      </div>
    `;
    root.querySelector('#startBtn').onclick = () => {
      const value = root.querySelector('#vehicleReg').value.trim();
      if (!value) {
        root.querySelector('#setupError').style.display = 'block';
        return;
      }
      vehicleReg = value;
      push({ screen: 'list' });
      renderList();
    };
    root.querySelector('#backBtn').onclick = () => onExit && onExit();
  }

  function renderList() {
    cleanupCamera();
    const remaining = items.filter(i => !i.status).length;
    root.innerHTML = `
      <div class="screen">
        <h2>Daily Walkaround Check</h2>
        <p class="muted small">${vehicleReg}</p>
        <div class="list">
          ${items.map(item => `
            <div class="list-item walkaround-item">
              <div class="list-item-main">
                <strong>${item.label}</strong>
                ${item.status === 'defect' ? `<p class="error small">Defect: ${item.description}</p>` : ''}
              </div>
              <div class="walkaround-item-actions">
                <button class="btn-secondary walkaround-pass-btn ${item.status === 'pass' ? 'walkaround-selected' : ''}" data-key="${item.key}">✔ Pass</button>
                <button class="btn-secondary walkaround-defect-btn ${item.status === 'defect' ? 'walkaround-selected' : ''}" data-key="${item.key}">⚠ Defect</button>
              </div>
            </div>
          `).join('')}
        </div>
        <p class="muted small">${remaining === 0 ? 'All items checked.' : `${remaining} of ${items.length} still need checking.`}</p>
        <button id="summaryBtn" class="btn-primary btn-large" ${remaining > 0 ? 'disabled' : ''}>View Summary</button>
        <button id="backBtn" class="btn-secondary">Cancel</button>
      </div>
    `;
    root.querySelectorAll('.walkaround-pass-btn').forEach(btn => {
      btn.onclick = async () => {
        const item = items.find(i => i.key === btn.dataset.key);
        item.status = 'pass';
        item.description = null;
        item.photo = null;
        item.photoHash = null;
        item.completedAt = Date.now();
        await saveDraft();
        renderList();
      };
    });
    root.querySelectorAll('.walkaround-defect-btn').forEach(btn => {
      btn.onclick = () => {
        push({ screen: 'defect-camera', key: btn.dataset.key });
        renderDefectCamera(btn.dataset.key);
      };
    });
    root.querySelector('#summaryBtn').onclick = () => {
      if (remaining > 0) return;
      push({ screen: 'summary' });
      renderSummary();
    };
    root.querySelector('#backBtn').onclick = () => history.back();
  }

  async function renderDefectCamera(key) {
    const item = items.find(i => i.key === key);
    root.innerHTML = `
      <div class="screen">
        <h2>${item.label}</h2>
        <p class="instruction">Take a photo of the defect.</p>
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
      push({ screen: 'defect-review', key });
      renderDefectReview(key, photo, photoHash, '');
    };
    root.querySelector('#backBtn').onclick = () => { cleanupCamera(); history.back(); };
  }

  async function renderDefectReview(key, photo, photoHash, description) {
    const item = items.find(i => i.key === key);
    const url = URL.createObjectURL(photo);

    const priorHashes = await sync.getTodaysWalkaroundItemHashes(key);
    const isDuplicate = priorHashes.some(h => isNearDuplicate(h, photoHash));

    root.innerHTML = `
      <div class="screen">
        <h2>${item.label} — Defect</h2>
        <img src="${url}" class="photo-preview" alt="Defect: ${item.label}" />
        ${isDuplicate ? '<p class="warning">This looks very similar to another photo for this item already taken today. Make sure this is a genuinely new photo before confirming.</p>' : ''}
        <label class="field">
          <span>Describe the fault</span>
          <textarea id="description" rows="3" placeholder="What's wrong, and where">${description}</textarea>
        </label>
        <p id="descError" class="error" style="display:none">Please describe the fault.</p>
        <button id="confirmBtn" class="btn-primary btn-large">✔ Confirm Defect</button>
        <button id="retakeBtn" class="btn-secondary">Retake</button>
      </div>
    `;
    root.querySelector('#confirmBtn').onclick = async () => {
      const desc = root.querySelector('#description').value.trim();
      if (!desc) {
        root.querySelector('#descError').style.display = 'block';
        return;
      }
      item.status = 'defect';
      item.description = desc;
      item.photo = photo;
      item.photoHash = photoHash;
      item.completedAt = Date.now();
      await saveDraft();
      history.go(-2); // back past this review and the camera screen, to the list
    };
    root.querySelector('#retakeBtn').onclick = () => renderDefectCamera(key);
  }

  function renderSummary() {
    const defects = items.filter(i => i.status === 'defect');
    root.innerHTML = `
      <div class="screen">
        <h2>Walkaround Check — Complete</h2>
        <p class="instruction">${vehicleReg} · ${items.length} items checked${defects.length ? `, ${defects.length} defect${defects.length > 1 ? 's' : ''} found` : ', all clear'}.</p>
        ${defects.length ? `
        <div class="thumb-grid">
          ${defects.map((d, i) => `
            <div class="thumb">
              <img src="${URL.createObjectURL(d.photo)}" alt="${d.label}" data-index="${i}" />
              <span>${d.label}</span>
            </div>
          `).join('')}
        </div>` : ''}
        <button id="saveBtn" class="btn-primary btn-large">Save Walkaround Check</button>
        <button id="discardBtn" class="btn-secondary">Discard</button>
      </div>
    `;
    root.querySelectorAll('.thumb img').forEach(img => {
      img.onclick = () => {
        const d = defects[Number(img.dataset.index)];
        openLightbox(sub, { screen: 'summary', depth: pushCount }, URL.createObjectURL(d.photo), d.label);
      };
    });
    root.querySelector('#saveBtn').onclick = async event => {
      const btn = event.currentTarget;
      if (btn.disabled) return;
      btn.disabled = true;
      btn.textContent = 'Saving…';
      const record = {
        id: recordId,
        vehicleReg,
        startedAt: items.find(i => i.completedAt)?.completedAt || Date.now(),
        completedAt: Date.now(),
        items: items.map(i => ({
          key: i.key, label: i.label, status: i.status, description: i.description,
          completedAt: i.completedAt, photoPath: null, photoHash: i.photoHash,
        })),
      };
      const photos = Object.fromEntries(defects.map(d => [d.key, d.photo]));
      await sync.enqueue('walkaround', record, photos);
      await clearDraft();
      exitToHome();
    };
    root.querySelector('#discardBtn').onclick = async () => {
      await clearDraft();
      exitToHome();
    };
  }

  sub.onPop(screen => {
    if (handleLightboxPop(screen)) return;
    pushCount = screen?.depth || 0;
    if (!screen) return renderSetup();
    if (screen.screen === 'defect-camera') return renderDefectCamera(screen.key);
    if (screen.screen === 'summary') return renderSummary();
    return renderList();
  });

  const existingDraft = await dbGet('drafts', draftId);
  if (existingDraft && existingDraft.items?.some(i => i.status)) {
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

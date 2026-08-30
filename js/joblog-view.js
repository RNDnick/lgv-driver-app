import { dbPut, dbGetAll, dbDelete, newId } from './db.js';
import { startCamera, stopCamera, captureFrame } from './camera.js';

function fmtDate(ts) {
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export async function renderJobLog(root, { onExit } = {}) {
  async function renderList() {
    const jobs = (await dbGetAll('jobs')).sort((a, b) => b.createdAt - a.createdAt);
    root.innerHTML = `
      <div class="screen">
        <h2>Job &amp; Delivery Log</h2>
        <button id="newJobBtn" class="btn-primary btn-large">+ New Job</button>
        <div class="list">
          ${jobs.length === 0 ? '<p class="muted">No jobs logged yet.</p>' : jobs.map(j => `
            <div class="list-item" data-id="${j.id}">
              <div class="list-item-main">
                <strong>${j.customer || 'Untitled job'}</strong>
                <span class="badge ${j.status}">${j.status}</span>
                <div class="muted">${j.collectionSite || '—'} → ${j.deliverySite || '—'}</div>
                <div class="muted small">${fmtDate(j.createdAt)}${j.trailerReg ? ' · ' + j.trailerReg : ''}</div>
              </div>
            </div>
          `).join('')}
        </div>
        <button id="backBtn" class="btn-secondary">Back</button>
      </div>
    `;
    root.querySelector('#newJobBtn').onclick = () => renderForm();
    root.querySelectorAll('.list-item').forEach(el => {
      el.onclick = () => renderDetail(jobs.find(j => j.id === el.dataset.id));
    });
    root.querySelector('#backBtn').onclick = () => onExit && onExit();
  }

  function renderForm() {
    root.innerHTML = `
      <div class="screen">
        <h2>New Job</h2>
        <label class="field"><span>Customer / Site name</span><input id="customer" type="text" /></label>
        <label class="field"><span>Collection site</span><input id="collectionSite" type="text" /></label>
        <label class="field"><span>Delivery site</span><input id="deliverySite" type="text" /></label>
        <label class="field"><span>Trailer registration</span><input id="trailerReg" type="text" /></label>
        <label class="field"><span>Mileage at start</span><input id="mileageStart" type="number" inputmode="numeric" /></label>
        <label class="field"><span>Notes</span><textarea id="notes" rows="3"></textarea></label>
        <button id="saveBtn" class="btn-primary btn-large">Save Job</button>
        <button id="cancelBtn" class="btn-secondary">Cancel</button>
      </div>
    `;
    root.querySelector('#saveBtn').onclick = async () => {
      const job = {
        id: newId(),
        status: 'open',
        createdAt: Date.now(),
        customer: root.querySelector('#customer').value.trim(),
        collectionSite: root.querySelector('#collectionSite').value.trim(),
        deliverySite: root.querySelector('#deliverySite').value.trim(),
        trailerReg: root.querySelector('#trailerReg').value.trim(),
        mileageStart: root.querySelector('#mileageStart').value || null,
        mileageEnd: null,
        notes: root.querySelector('#notes').value.trim(),
        podPhoto: null,
        completedAt: null,
      };
      await dbPut('jobs', job);
      renderList();
    };
    root.querySelector('#cancelBtn').onclick = () => renderList();
  }

  function renderDetail(job) {
    root.innerHTML = `
      <div class="screen">
        <h2>${job.customer || 'Job'}</h2>
        <span class="badge ${job.status}">${job.status}</span>
        <p class="muted">${job.collectionSite || '—'} → ${job.deliverySite || '—'}</p>
        <p class="muted small">Created ${fmtDate(job.createdAt)}${job.trailerReg ? ' · ' + job.trailerReg : ''}</p>
        ${job.mileageStart ? `<p>Mileage start: ${job.mileageStart}${job.mileageEnd ? ' · end: ' + job.mileageEnd : ''}</p>` : ''}
        ${job.notes ? `<p>${job.notes}</p>` : ''}
        ${job.podPhoto ? `<img class="photo-preview" src="${URL.createObjectURL(job.podPhoto)}" alt="Proof of delivery" />` : ''}
        ${job.status === 'open' ? '<button id="completeBtn" class="btn-primary btn-large">Mark Delivered (capture POD)</button>' : ''}
        <button id="deleteBtn" class="btn-secondary">Delete</button>
        <button id="backBtn" class="btn-secondary">Back</button>
      </div>
    `;
    if (job.status === 'open') {
      root.querySelector('#completeBtn').onclick = () => renderComplete(job);
    }
    root.querySelector('#deleteBtn').onclick = async () => {
      await dbDelete('jobs', job.id);
      renderList();
    };
    root.querySelector('#backBtn').onclick = () => renderList();
  }

  async function renderComplete(job) {
    let stream = null;
    root.innerHTML = `
      <div class="screen">
        <h2>Proof of Delivery</h2>
        <label class="field"><span>Mileage at end</span><input id="mileageEnd" type="number" inputmode="numeric" /></label>
        <video id="cam" playsinline autoplay muted class="camera-preview"></video>
        <button id="captureBtn" class="btn-primary btn-large">📷 Capture POD Photo</button>
        <button id="skipBtn" class="btn-secondary">Save Without Photo</button>
        <button id="cancelBtn" class="btn-secondary">Cancel</button>
      </div>
    `;
    const videoEl = root.querySelector('#cam');
    const captureBtn = root.querySelector('#captureBtn');
    try {
      stream = await startCamera(videoEl);
    } catch (err) {
      root.querySelector('.camera-preview').outerHTML = `<p class="error">Camera unavailable: ${err.message}</p>`;
      captureBtn.disabled = true;
      captureBtn.textContent = 'Camera unavailable';
    }
    async function finish(photo) {
      stopCamera(stream);
      job.mileageEnd = root.querySelector('#mileageEnd').value || null;
      job.podPhoto = photo || null;
      job.status = 'complete';
      job.completedAt = Date.now();
      await dbPut('jobs', job);
      renderList();
    }
    captureBtn.onclick = async () => {
      const photo = await captureFrame(videoEl);
      finish(photo);
    };
    root.querySelector('#skipBtn').onclick = () => finish(null);
    root.querySelector('#cancelBtn').onclick = () => { stopCamera(stream); renderDetail(job); };
  }

  renderList();
}

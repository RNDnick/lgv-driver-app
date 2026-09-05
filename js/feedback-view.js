import { newId } from './db.js';
import * as sync from './sync.js';
import * as backend from './backend.js';

function fmtDate(ts) {
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Feedback messages are free text from the driver, rendered back for a
// manager to read - escape before it ever reaches innerHTML.
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export async function renderFeedback(root, { onExit } = {}) {
  const profile = await backend.getCurrentProfile();
  const isManager = profile?.role === 'manager';
  let inbox = [];
  let inboxError = '';
  if (isManager) {
    try {
      inbox = await backend.getAllFeedback();
    } catch (err) {
      inboxError = err.message;
    }
  }

  function inboxHtml() {
    if (inboxError) {
      return `<h3>Submitted feedback</h3><p class="error">Couldn't load: ${inboxError}</p>`;
    }
    if (!inbox.length) {
      return `<h3>Submitted feedback</h3><p class="muted">Nothing submitted yet.</p>`;
    }
    return `
      <h3>Submitted feedback</h3>
      <div class="list">
        ${inbox.map(f => `
          <div class="list-item">
            <div class="list-item-main">
              <strong>${escapeHtml(f.driverName)}</strong>
              <div class="muted small">${fmtDate(f.createdAt)}</div>
              <p class="instruction">${escapeHtml(f.message)}</p>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function render(sent) {
    root.innerHTML = `
      <div class="screen">
        <h2>Feedback</h2>
        ${sent ? `
          <p class="instruction">Thanks — your feedback has been sent.</p>
        ` : `
          <p class="muted">Spotted a bug, or got an idea that'd help? Let us know.</p>
          <label class="field">
            <span>Your feedback</span>
            <textarea id="feedbackText" rows="5" placeholder="Type your feedback here..."></textarea>
          </label>
          <p id="feedbackError" class="error" style="display:none">Please enter a message before sending.</p>
          <button id="sendBtn" class="btn-primary btn-large">Send Feedback</button>
        `}
        <button id="backBtn" class="btn-secondary">Back</button>
        ${isManager ? inboxHtml() : ''}
      </div>
    `;
    if (!sent) {
      root.querySelector('#sendBtn').onclick = async () => {
        const value = root.querySelector('#feedbackText').value.trim();
        if (!value) {
          root.querySelector('#feedbackError').style.display = 'block';
          return;
        }
        await sync.enqueue('feedback', { id: newId(), message: value, createdAt: Date.now() });
        render(true);
      };
    }
    root.querySelector('#backBtn').onclick = () => onExit && onExit();
  }

  render(false);
}

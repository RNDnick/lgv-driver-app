import { newId } from './db.js';
import * as sync from './sync.js';

export function renderFeedback(root, { onExit } = {}) {
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

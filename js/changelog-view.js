import { CHANGELOG } from './changelog-data.js';

export function renderChangelog(root, { onExit } = {}) {
  root.innerHTML = `
    <div class="screen">
      <h2>What's New</h2>
      <div class="list">
        ${CHANGELOG.map(entry => `
          <div class="list-item">
            <div class="list-item-main">
              <strong>v${entry.version}</strong>
              <div class="muted small">${entry.date}</div>
              <p class="instruction">${entry.summary}</p>
            </div>
          </div>
        `).join('')}
      </div>
      <button id="backBtn" class="btn-secondary">Back</button>
    </div>
  `;
  root.querySelector('#backBtn').onclick = () => onExit && onExit();
}

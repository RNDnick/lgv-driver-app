// A full-screen image viewer any view can drop in. It renders on top of the
// calling view's existing DOM (not a replacement, so nothing underneath is
// disturbed) and piggybacks on that view's own subrouter so the phone's back
// button and tapping outside the image both close it the same way - call
// handleLightboxPop() first thing in the view's sub.onPop handler.
let overlayEl = null;

function showOverlay(url, alt) {
  hideOverlay();
  overlayEl = document.createElement('div');
  overlayEl.className = 'lightbox-overlay';
  overlayEl.innerHTML = `<img src="${url}" alt="${alt || ''}" />`;
  overlayEl.addEventListener('click', event => {
    if (event.target === overlayEl) history.back();
  });
  document.body.appendChild(overlayEl);
}

function hideOverlay() {
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
}

export function openLightbox(sub, baseScreen, url, alt) {
  sub.push({ ...baseScreen, lightboxUrl: url, lightboxAlt: alt });
  showOverlay(url, alt);
}

// Returns true if this pop was just opening/closing the lightbox, in which
// case the caller should return immediately instead of re-dispatching -
// the screen underneath never needed to change.
export function handleLightboxPop(screen) {
  if (screen && screen.lightboxUrl) {
    showOverlay(screen.lightboxUrl, screen.lightboxAlt);
    return true;
  }
  if (overlayEl) {
    hideOverlay();
    return true;
  }
  return false;
}

export async function startCamera(videoEl) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' } },
    audio: false,
  });
  videoEl.srcObject = stream;
  await videoEl.play();
  await enableTorchIfAvailable(stream);
  return stream;
}

// Trailer hardware (kingpin, dog clip) is often photographed underneath the
// trailer in near-total darkness. The web platform only exposes a continuous
// "torch" light, not a single-shot flash — which suits us fine since we grab
// frames from a live preview rather than taking a discrete photo. Not
// supported at all on iOS Safari (no web API for it), so this silently no-ops
// there rather than failing the capture.
async function enableTorchIfAvailable(stream) {
  if (!isTorchSupported(stream)) return;
  await setTorch(stream, true);
}

export function isTorchSupported(stream) {
  const track = stream?.getVideoTracks()[0];
  return !!track?.getCapabilities?.().torch;
}

export async function setTorch(stream, on) {
  const track = stream?.getVideoTracks()[0];
  if (!track) return false;
  try {
    await track.applyConstraints({ advanced: [{ torch: on }] });
    return true;
  } catch {
    // Some devices report torch support but reject the constraint anyway.
    return false;
  }
}

// Wires a torch icon button. On a device that actually supports it (torch
// starts on already, via enableTorchIfAvailable), this toggles it off/on. On
// iOS and anything else without the capability, there's no API to fall back
// to - tapping it instead reveals a tip pointing the driver at their phone's
// own flashlight control, since that's the ceiling of what a web page can do.
export function wireTorchButton(torchBtn, tipEl, stream) {
  if (isTorchSupported(stream)) {
    let torchOn = true;
    torchBtn.classList.add('torch-on');
    torchBtn.onclick = async () => {
      torchOn = !torchOn;
      await setTorch(stream, torchOn);
      torchBtn.classList.toggle('torch-on', torchOn);
    };
  } else {
    torchBtn.onclick = () => {
      tipEl.style.display = tipEl.style.display === 'none' ? 'block' : 'none';
    };
  }
}

export function stopCamera(stream) {
  if (!stream) return;
  stream.getTracks().forEach(track => track.stop());
}

// zoomLevel > 1 crops a centered region of the frame and scales it back up to
// the original dimensions - the digital-zoom fallback path. Hardware zoom
// (see createZoomControl below) already produces a zoomed frame from the
// camera itself, so callers pass 1 there and this just captures normally.
export function captureFrame(videoEl, zoomLevel = 1) {
  const canvas = document.createElement('canvas');
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  canvas.width = vw;
  canvas.height = vh;
  const ctx = canvas.getContext('2d');
  if (zoomLevel > 1) {
    const cropW = vw / zoomLevel;
    const cropH = vh / zoomLevel;
    const sx = (vw - cropW) / 2;
    const sy = (vh - cropH) / 2;
    ctx.drawImage(videoEl, sx, sy, cropW, cropH, 0, 0, vw, vh);
  } else {
    ctx.drawImage(videoEl, 0, 0);
  }
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
}

const ZOOM_LEVELS = [1, 2, 3];

// Kingpin photos in particular are taken from well back (the driver has to
// reverse fully under the trailer first), so the subject can end up small and
// unclear in frame. Prefers the camera's real hardware zoom where the device
// exposes one (full resolution, no quality loss); falls back to a digital
// crop-and-scale of the preview/capture everywhere else (mainly iOS, which -
// like torch - has no zoom API for web apps at all).
export function createZoomControl(zoomBtn, videoEl, stream) {
  const track = stream?.getVideoTracks()[0];
  const capabilities = track?.getCapabilities?.();
  const hardwareZoom = capabilities?.zoom;
  let index = 0;

  zoomBtn.textContent = `${ZOOM_LEVELS[index]}x`;

  zoomBtn.onclick = async () => {
    index = (index + 1) % ZOOM_LEVELS.length;
    const level = ZOOM_LEVELS[index];
    zoomBtn.classList.toggle('zoom-active', level > 1);
    if (hardwareZoom) {
      const target = Math.min(hardwareZoom.max, Math.max(hardwareZoom.min, level));
      try {
        await track.applyConstraints({ advanced: [{ zoom: target }] });
      } catch {
        // Ignore - button label still reflects the requested level below.
      }
      zoomBtn.textContent = `${target}x`;
    } else {
      videoEl.style.transform = `scale(${level})`;
      zoomBtn.textContent = `${level}x`;
    }
  };

  return {
    getDigitalZoomLevel: () => (hardwareZoom ? 1 : ZOOM_LEVELS[index]),
  };
}

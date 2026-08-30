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

export function captureFrame(videoEl) {
  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  canvas.getContext('2d').drawImage(videoEl, 0, 0);
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
}

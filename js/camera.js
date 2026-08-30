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
  const track = stream.getVideoTracks()[0];
  const capabilities = track?.getCapabilities?.();
  if (!capabilities?.torch) return;
  try {
    await track.applyConstraints({ advanced: [{ torch: true }] });
  } catch {
    // Some devices report torch support but reject the constraint anyway.
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

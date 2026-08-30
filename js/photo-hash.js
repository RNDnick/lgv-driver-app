// Perceptual hash (dHash): resistant to minor recompression, but two genuinely
// different photos of the same object type at similar framing can still land
// close together, so this is a nudge to double-check, never a hard block.
const HASH_COLS = 9;
const HASH_ROWS = 8;

export async function hashBlob(blob) {
  const bitmap = await createImageBitmap(blob);

  // Downscale in two stages with smoothing enabled — a direct jump straight to a
  // 9x8 grid aliases badly on real camera photos (high source resolution, fine
  // detail), which swamps the gradient signal dHash relies on.
  const mid = document.createElement('canvas');
  mid.width = 64;
  mid.height = 64;
  const midCtx = mid.getContext('2d');
  midCtx.imageSmoothingEnabled = true;
  midCtx.imageSmoothingQuality = 'high';
  midCtx.drawImage(bitmap, 0, 0, 64, 64);

  const canvas = document.createElement('canvas');
  canvas.width = HASH_COLS;
  canvas.height = HASH_ROWS;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(mid, 0, 0, HASH_COLS, HASH_ROWS);
  const { data } = ctx.getImageData(0, 0, HASH_COLS, HASH_ROWS);

  const gray = [];
  for (let i = 0; i < data.length; i += 4) {
    gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }

  let bits = '';
  for (let row = 0; row < HASH_ROWS; row++) {
    for (let col = 0; col < HASH_COLS - 1; col++) {
      const idx = row * HASH_COLS + col;
      bits += gray[idx] > gray[idx + 1] ? '1' : '0';
    }
  }

  let hex = '';
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

export function hammingDistance(hexA, hexB) {
  if (!hexA || !hexB || hexA.length !== hexB.length) return Infinity;
  let dist = 0;
  for (let i = 0; i < hexA.length; i++) {
    let xor = parseInt(hexA[i], 16) ^ parseInt(hexB[i], 16);
    while (xor) {
      dist += xor & 1;
      xor >>= 1;
    }
  }
  return dist;
}

// Out of 64 bits. Deliberately loose: independent camera captures generate a lot
// of gradient noise (auto-exposure, focus, hand shake), and testing against real
// photos showed no clean separation between "same static scene" and "genuinely
// different scene" — so this leans toward flagging more, on the assumption that a
// non-blocking warning plus manager review is an acceptable backstop for the
// false positives that come with it.
export const NEAR_DUPLICATE_THRESHOLD = 16;

export function isNearDuplicate(hexA, hexB, threshold = NEAR_DUPLICATE_THRESHOLD) {
  return hammingDistance(hexA, hexB) <= threshold;
}

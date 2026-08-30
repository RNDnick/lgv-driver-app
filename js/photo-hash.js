// Perceptual hash (dHash): resistant to minor recompression, but two genuinely
// different photos of the same object type at similar framing can still land
// close together, so this is a nudge to double-check, never a hard block.
const HASH_COLS = 9;
const HASH_ROWS = 8;

export async function hashBlob(blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = HASH_COLS;
  canvas.height = HASH_ROWS;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, HASH_COLS, HASH_ROWS);
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

export const NEAR_DUPLICATE_THRESHOLD = 10;

export function isNearDuplicate(hexA, hexB, threshold = NEAR_DUPLICATE_THRESHOLD) {
  return hammingDistance(hexA, hexB) <= threshold;
}

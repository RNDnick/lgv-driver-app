export const CONNECT_STEPS = [
  { key: 'K', title: 'Kingpin', instruction: 'Reverse fully under the trailer. Check the kingpin is engaged and locked into the fifth wheel.' },
  { key: 'C', title: 'Dog Clip', instruction: 'Check the fifth wheel locking handle dog clip is in place, preventing it from working loose.' },
  { key: 'A', title: 'Airlines', instruction: 'Connect the airline (suzie) couplings to the trailer.' },
  { key: 'L', title: 'Legs', instruction: 'Wind the trailer landing legs fully up.' },
  { key: 'B', title: 'Brake', instruction: 'Release the trailer brake. Complete your walkaround safety check before pulling away.' },
];

export const DISCONNECT_STEPS = [
  { key: 'B', title: 'Brake', instruction: 'Apply the trailer brake.' },
  { key: 'L', title: 'Legs', instruction: 'Wind the trailer landing legs down onto firm, level ground.' },
  { key: 'A', title: 'Airlines', instruction: 'Disconnect the airline (suzie) couplings from the trailer.' },
  { key: 'C', title: 'Dog Clip', instruction: 'Release the fifth wheel locking handle dog clip.' },
  { key: 'K', title: 'Kingpin', instruction: 'Pull the fifth wheel release handle to release the kingpin, then drive clear of the trailer.' },
];

export function getSteps(type) {
  return type === 'connect' ? CONNECT_STEPS : DISCONNECT_STEPS;
}

export function getLabel(type) {
  return type === 'connect' ? 'Connecting Trailer (KCALB)' : 'Dropping Trailer (BLACK)';
}

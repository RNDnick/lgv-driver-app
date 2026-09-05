// Step wording matches the company's physical "Trailer Coupling/Uncoupling
// Process" signage exactly, including the Close variants (used when there's
// limited room to reverse fully under the trailer before connecting the
// air lines) - a genuinely different step order, not just a relabelling.
export const CHECKLIST_TYPES = {
  connect: {
    label: 'Standard Trailer Coupling',
    mnemonic: 'K · C · A · L · B',
    steps: [
      { key: 'K', title: 'Kingpin', instruction: "Check the trailer brake is applied, and the 5th wheel and trailer height are compatible. Connect the kingpin, then complete two tugs to confirm it's locked." },
      { key: 'C', title: 'Clip', instruction: 'Insert the dog clip into the 5th wheel handle.' },
      { key: 'A', title: 'Airlines', instruction: 'Connect the air lines & leads fully.' },
      { key: 'L', title: 'Legs', instruction: 'Wind the trailer legs fully up and stow the handle securely.' },
      { key: 'B', title: 'Brake', instruction: 'Release the park brake and complete a walk round check.' },
    ],
  },
  disconnect: {
    label: 'Standard Trailer Uncoupling',
    mnemonic: 'B · L · A · C · K',
    steps: [
      { key: 'B', title: 'Brake', instruction: 'Ensure the tractor unit and trailer park brakes are applied.' },
      { key: 'L', title: 'Legs', instruction: 'Wind the trailer legs fully down and stow the handle.' },
      { key: 'A', title: 'Airlines', instruction: 'Disconnect the air lines & leads and stow in the dummy peg.' },
      { key: 'C', title: 'Clip', instruction: 'Remove the dog/safety clip from the 5th wheel handle.' },
      { key: 'K', title: 'Kingpin', instruction: 'Pull the 5th wheel handle to release the kingpin and remove the tractor unit, then complete a walk round check.' },
    ],
  },
  'close-connect': {
    label: 'Close Trailer Coupling',
    mnemonic: 'A · K · C · L · B',
    steps: [
      { key: 'A', title: 'Airlines', instruction: 'Check the trailer brake is applied, and the 5th wheel and trailer height are compatible. Reverse partially under the trailer, then connect the air lines & leads.' },
      { key: 'K', title: 'Kingpin', instruction: "Reverse fully and connect the kingpin, then complete two tugs to confirm it's locked." },
      { key: 'C', title: 'Clip', instruction: 'Insert the dog clip into the 5th wheel handle.' },
      { key: 'L', title: 'Legs', instruction: 'Wind the trailer legs fully up and stow the handle securely.' },
      { key: 'B', title: 'Brake', instruction: 'Release the park brake and complete a walk round check.' },
    ],
  },
  'close-disconnect': {
    label: 'Close Trailer Uncoupling',
    mnemonic: 'B · L · C · K · A',
    steps: [
      { key: 'B', title: 'Brake', instruction: 'Ensure the tractor unit and trailer park brake are applied.' },
      { key: 'L', title: 'Legs', instruction: 'Wind the trailer legs fully down and stow the handle.' },
      { key: 'C', title: 'Clip', instruction: 'Remove the dog/safety clip from the 5th wheel handle.' },
      { key: 'K', title: 'Kingpin', instruction: 'Pull the 5th wheel handle to release the kingpin and pull the tractor unit forward to access the air lines & leads.' },
      { key: 'A', title: 'Airlines', instruction: 'Disconnect the air lines & leads and stow in the dummy pegs, then remove the tractor unit fully and complete a walk round check.' },
    ],
  },
};

export function getSteps(type) {
  return CHECKLIST_TYPES[type]?.steps || [];
}

export function getLabel(type) {
  return CHECKLIST_TYPES[type]?.label || type;
}

export function getMnemonic(type) {
  return CHECKLIST_TYPES[type]?.mnemonic || '';
}

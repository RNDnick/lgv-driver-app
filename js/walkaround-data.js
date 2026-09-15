// The legally-required UK HGV daily walkaround check, done every shift
// regardless of whether a trailer is coupled that day - separate from (and
// in addition to) the coupling/uncoupling checklists. Matches DVSA daily
// walkaround guidance. Extensible the same way checklists-data.js is, so a
// fleet can tune the item list later without code changes.
export const WALKAROUND_ITEMS = [
  { key: 'fluids', label: 'Fluid leaks (oil/fuel/coolant) & levels' },
  { key: 'windscreen', label: 'Windscreen, windows & wipers/washers' },
  { key: 'mirrors', label: 'Mirrors' },
  { key: 'horn', label: 'Horn' },
  { key: 'seatbelts', label: 'Seatbelts' },
  { key: 'steering', label: 'Steering (free play)' },
  { key: 'tyres', label: 'Tyres & wheel fixings' },
  { key: 'suspension', label: 'Suspension' },
  { key: 'bodywork', label: 'Bodywork & doors' },
  { key: 'plates', label: 'Number plates' },
  { key: 'lights', label: 'Lights, indicators & hazards' },
  { key: 'reflectors', label: 'Reflectors & markers' },
  { key: 'exhaust', label: 'Exhaust' },
  { key: 'battery', label: 'Battery' },
  { key: 'coupling', label: 'Coupling security & air lines' },
  { key: 'load', label: 'Load security' },
  { key: 'equipment', label: 'Mandatory equipment (warning triangle, spare bulbs, fire extinguisher)' },
];

export function getWalkaroundItems() {
  return WALKAROUND_ITEMS;
}

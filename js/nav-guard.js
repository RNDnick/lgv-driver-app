// Most in-view back navigation is handled entirely within that view's own
// subrouter (see subrouter.js). The one case that can't be is leaving a view
// entirely (its own top-level history entry popping back to Home) - app.js's
// global popstate listener owns that transition, but only the view itself
// knows whether there's meaningful unconfirmed work to protect. This lets a
// mounted view register a check for exactly that moment.
let guardFn = null;

export function setLeaveGuard(fn) {
  guardFn = fn;
}

export function clearLeaveGuard() {
  guardFn = null;
}

export function checkLeaveGuard() {
  return !guardFn || guardFn();
}

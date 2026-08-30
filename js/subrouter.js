// Each top-level view (checklist flow, job log, history) owns a slice of the
// browser history stack for its own internal screens (steps, list/detail,
// etc.), separate from app.js's top-level view switching. A view's states are
// tagged { view: <name>, screen }, so app.js's global popstate listener can
// tell "an internal screen change within the still-active view" (ignore, let
// this subrouter handle it) apart from "actually leaving to a different
// top-level view" (remount).
export function createSubRouter(viewName) {
  let popHandler = null;

  function handleEvent(event) {
    const state = event.state;
    if (!state || state.view !== viewName) return;
    popHandler && popHandler(state.screen || null);
  }

  window.addEventListener('popstate', handleEvent);

  return {
    push(screen) {
      history.pushState({ view: viewName, screen }, '');
    },
    replace(screen) {
      history.replaceState({ view: viewName, screen }, '');
    },
    onPop(handler) {
      popHandler = handler;
    },
    destroy() {
      window.removeEventListener('popstate', handleEvent);
    },
  };
}

// For an in-app Cancel/Back button on a screen holding typed/captured-but-
// unsaved data: confirm first if there's something to lose, then go back
// through normal history navigation so the hardware back button and this
// button always behave identically.
export function confirmExit(message, hasUnsavedWork) {
  if (hasUnsavedWork && !window.confirm(message)) return;
  history.back();
}

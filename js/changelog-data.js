// Add one entry here whenever a user-visible change ships, newest first.
// Keep summaries short and in plain language - this is read by drivers, not
// developers.
export const CHANGELOG = [
  {
    version: '1.16.0',
    date: '5 Sep 2026',
    summary: "Added a Manager Dashboard (visible only on a manager account) - every driver's checklists, jobs and feedback in one place, tagged with who did what, with full photo evidence. History and Job Log go back to showing just your own records, like every driver sees. Also fixed a bug where switching apps and back could silently bounce you to the home screen mid-task.",
  },
  {
    version: '1.15.0',
    date: '5 Sep 2026',
    summary: "Added a Feedback link under the version number on the home screen - tap it any time to send through a bug report or an idea, offline-safe like everything else. It's sent with your name attached so we can follow up if needed.",
  },
  {
    version: '1.14.0',
    date: '5 Sep 2026',
    summary: 'Every photo now gets a timestamp (YY-MM-DD-HH-MM-SS, your phone\'s local time) burned into the bottom-right corner - checklist steps and the delivery photo alike - so there\'s a permanent record of exactly when each check was done.',
  },
  {
    version: '1.13.1',
    date: '5 Sep 2026',
    summary: 'Standard Uncoupling and Close Uncoupling now pre-fill the trailer registration from your last matching coupling, so you don’t have to type it again - still editable if it’s wrong.',
  },
  {
    version: '1.13.0',
    date: '5 Sep 2026',
    summary: "Standard Coupling/Uncoupling wording now matches the company's signage exactly. Added two new checklists for tighter yards: Close Coupling and Close Uncoupling, which connect/disconnect the air lines before reversing fully under the trailer instead of after.",
  },
  {
    version: '1.12.1',
    date: '2 Sep 2026',
    summary: 'Sync error messages on the Sync Status screen are now more specific about which step failed (uploading a photo vs. saving the record), to help track down stubborn sync failures.',
  },
  {
    version: '1.12.0',
    date: '2 Sep 2026',
    summary: "The \"records waiting to sync\" banner on the home screen is now tappable, showing exactly which checklists/jobs haven't synced yet, why (if it's actually failing rather than just waiting for signal), and a \"Sync Now\" button to retry immediately.",
  },
  {
    version: '1.11.0',
    date: '2 Sep 2026',
    summary: 'Tap any photo (in History, a finished checklist summary, or a delivery photo) to see it full-screen. Tap outside the photo, or use back, to close it and return to exactly where you were.',
  },
  {
    version: '1.10.0',
    date: '1 Sep 2026',
    summary: "Added a zoom button on the camera screen (tap to cycle 1x/2x/3x) - handy for the Kingpin photo, which often has to be taken from further back than the other steps.",
  },
  {
    version: '1.9.1',
    date: '1 Sep 2026',
    summary: 'Added a copyright notice at the bottom of every screen.',
  },
  {
    version: '1.9.0',
    date: '1 Sep 2026',
    summary: "Added this What's New page - tap the version number on the home screen any time to see what's changed recently.",
  },
  {
    version: '1.8.1',
    date: '1 Sep 2026',
    summary: "The New Job form now survives an interrupted session too - if your screen locks or the app closes while you're filling it in, reopening Job Log offers to pick up exactly where you left off.",
  },
  {
    version: '1.8.0',
    date: '1 Sep 2026',
    summary: 'A checklist in progress now survives your screen locking or the app closing unexpectedly. Reopening Connect Trailer or Drop Trailer detects an interrupted checklist and offers to resume it, photos included.',
  },
  {
    version: '1.7.2',
    date: '31 Aug 2026',
    summary: 'Renamed the app to SafeCouple throughout, matching our new safecouple.app address.',
  },
  {
    version: '1.7.0',
    date: '31 Aug 2026',
    summary: "Fixed the app so it can properly be installed as a home screen icon on your phone, with its own app icon.",
  },
  {
    version: '1.6.0',
    date: '30 Aug 2026',
    summary: "Your phone's back button now steps back one screen at a time - through checklist steps, job details, and history - instead of jumping straight to the home screen.",
  },
  {
    version: '1.5.0',
    date: '30 Aug 2026',
    summary: 'Fixed the back button so it navigates within the app instead of taking you out of it.',
  },
  {
    version: '1.4.4',
    date: '30 Aug 2026',
    summary: 'Fixed the duplicate-photo check so it also catches the same photo being reused across different steps within one checklist, not just across separate checklists.',
  },
  {
    version: '1.4.1',
    date: '30 Aug 2026',
    summary: 'Trailer registration is now required before starting a checklist or logging a job.',
  },
  {
    version: '1.4.0',
    date: '30 Aug 2026',
    summary: 'Added a flash/torch button for photos taken in dark spots under the trailer, with the flash turning on automatically on supported phones.',
  },
  {
    version: '1.2.0',
    date: '30 Aug 2026',
    summary: "Added a warning if a photo looks like a duplicate of one you've already taken today, to help catch accidental or reused photos.",
  },
  {
    version: '1.1.0',
    date: '30 Aug 2026',
    summary: 'Added driver accounts - each driver now has their own private login, with checklists and jobs synced automatically and safely queued if you lose signal.',
  },
  {
    version: '1.0.0',
    date: '30 Aug 2026',
    summary: 'Initial release: a photo-verified trailer coupling/uncoupling checklist and a job & delivery log.',
  },
];

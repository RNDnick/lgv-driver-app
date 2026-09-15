# SafeCouple

A mobile-first web app for LGV drivers: a photo-verified trailer coupling/uncoupling
checklist, plus a job & delivery log. Each driver has their own private login;
data is synced to a shared Supabase backend so it isn't stuck on one device.
Multi-tenant: signing up creates a new company, and one company can never see
another's data — this is a product meant to be sold to multiple separate fleets,
not just RND Tech's own.

## Features

- **Four checklist types**, wording matched exactly to the company's physical
  signage, each walking through its steps with an instruction and a camera
  capture per step so you end up with photo evidence for every check:
  - **Standard Trailer Coupling (KCALB)** — Kingpin, Clip, Airlines, Legs, Brake.
  - **Standard Trailer Uncoupling (BLACK)** — Brake, Legs, Airlines, Clip, Kingpin.
  - **Close Trailer Coupling (AKCLB)** — for tight yards: connect the air lines
    after reversing only partially under the trailer, then reverse fully and
    connect the kingpin, Clip, Legs, Brake.
  - **Close Trailer Uncoupling (BLCKA)** — Brake, Legs, Clip, Kingpin, then pull
    forward to access and disconnect the air lines.
- **Daily Walkaround Check** — the legally-required UK HGV pre-trip inspection
  (tyres, lights, brakes, fluid leaks, mirrors and more), separate from trailer
  coupling and done every shift regardless of whether a trailer's attached.
  Each item is a quick pass/fail rather than a mandatory photo — marking one a
  defect prompts for a photo and a short description on the spot.
- **Defect Reporting** — marking a walkaround item "Defect", or using the
  optional "Report a Defect" button on a coupling checklist step, raises a
  tracked defect a manager can see on the Dashboard. Each one moves through
  open → acknowledged → resolved, with resolution notes, giving a full audit
  trail from a driver spotting a fault to it actually being fixed — only a
  manager account can move a defect through that trail, not the driver who
  raised it.
- **Job & Delivery Log** — log collection/delivery sites, trailer reg, mileage,
  notes, and capture a proof-of-delivery photo when a job completes.
- **History** — browse past checklist runs and their photos. Tap any photo
  (here, a finished checklist's summary, or a delivery photo) to view it
  full-screen — tap outside it or use back to return to exactly where you were.
- **Offline-safe saves** — every save writes to a local queue first and syncs to
  the backend automatically once you have a signal, so nothing is lost if you're
  in a poor-signal yard when you finish a check. Tap the "records waiting to
  sync" banner on the home screen to see exactly what's queued, why it hasn't
  gone through yet if it's actually failing (not just waiting for signal), and
  to trigger a retry immediately with "Sync Now".
- **Same-day duplicate photo warning** — each photo is fingerprinted on-device
  (a perceptual hash, not the exact bytes) and compared against your other
  photos from *today only* for that same step. A near-identical match shows a
  warning before you confirm — it doesn't block you, since it's a nudge to
  double-check, not a determination of fraud. Yesterday's brake-on photo
  naturally looks a lot like today's, so only same-day matches are checked.

A checklist run can optionally be linked to an open job.

- **Timestamped photos** — every photo (each checklist step, and the delivery
  proof-of-delivery photo) gets a `YY-MM-DD-HH-MM-SS` timestamp burned into the
  bottom-right corner, in the phone's local time, so there's a permanent visual
  record of exactly when each photo was taken.

- **Survives a screen lock mid-checklist or mid-form** — a phone locking or
  backgrounding the app can discard the page from memory entirely, not just
  pause it, which would otherwise silently wipe whatever was in progress. A
  Connect/Drop Trailer checklist checkpoints every confirmed step immediately;
  the New Job form checkpoints as you type. Reopening after an interruption
  offers to resume exactly where you left off — photos included — instead of
  losing it.

## Running it

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1
```

Then open `http://localhost:8935` in a browser.

## Using it on your phone

Camera access requires either `localhost` or **HTTPS** — browsers block camera
access on a plain `http://` address that isn't localhost. To use this in the cab
on your phone, deploy the folder somewhere with HTTPS (e.g. GitHub Pages, Netlify,
Vercel — all free for a static site like this), then open that HTTPS URL on your
phone and "Add to Home Screen" for an app-like icon.

The app tries to turn the camera flash (torch) on automatically for every photo,
since kingpin/dog clip photos are often taken underneath the trailer in near-total
darkness. This works on Android Chrome but **not on iOS Safari** — Apple doesn't
expose flash control to web apps at all, so on an iPhone the driver will need to
provide their own light (phone torch via Control Centre, work light, etc.)
before taking those photos.

Each camera screen also has a zoom button (top-left of the preview, tap to
cycle 1x/2x/3x) — useful for the Kingpin photo especially, since the driver
has to reverse fully under the trailer before shooting it, often leaving it
further away and smaller in frame than the other steps. Uses the phone's real
optical/hardware zoom where the browser exposes one (mainly Android Chrome,
full resolution); falls back to a digital crop-and-scale everywhere else
(notably iOS, which has no zoom API for web apps either) — works everywhere,
just with a little less sharpness at higher zoom on devices using the
fallback.

- **Feedback** — a link under the version number on the home screen lets a
  driver send through a bug report or an idea any time. Sent the same
  offline-safe way as everything else, and attributed to that driver (not
  anonymous) so a manager can follow up.
- **Manager Dashboard** — a manager account (see below) gets an extra home
  screen tile showing every driver's checklists, walkaround checks, jobs,
  defects, and submitted feedback in one place, each tagged with who it
  belongs to. Tapping a checklist shows its full photo evidence, same as
  History does for your own. Defects can be moved from open to acknowledged
  to resolved right from their detail screen, with optional resolution
  notes. Every other screen (History, Job Log, the home screen's
  recent-activity list) only ever shows your own records, manager account or
  not — the Dashboard is the one place that shows everyone's.

## Backend setup (Supabase)

This app talks directly to a Supabase project (Postgres + Auth + Storage) from
the browser using a public, RLS-protected key — there's no server to run or host.

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL Editor — it creates the
   `companies`/`profiles`/`jobs`/`checklists`/`walkaround_checks`/`defects`/
   `feedback` tables, Row-Level Security policies, and the private
   `checklist-photos` storage bucket.
3. In Authentication → URL Configuration, add your deployed URL to the redirect
   allow-list.
4. Put your project's URL and publishable/anon key in `js/supabase-client.js`.
   These are safe to be public — access is enforced by RLS, not by keeping the
   key secret. Never put the `service_role` key here.
5. Signing up creates a brand-new company automatically (the "Company name"
   field on Sign Up) — there's no in-app way yet for a second driver to join an
   *existing* company, so for now add them to the same company row manually via
   Supabase's Table Editor if needed.
6. To make an account a fleet manager (read access to every driver's data
   *within their own company only*), set that row's `role` to `'manager'` in
   the `profiles` table via Supabase's Table Editor — there's no in-app UI for
   this yet.

## Data & privacy

Jobs, checklist records, and photos are stored in your Supabase project,
scoped per driver by Row-Level Security — one driver cannot see another
driver's data, except a `manager`-role account, which can see everyone's
*within the same company* — never another company's data, even another
manager's. A save is written to a local on-device queue first and synced to
Supabase in the background, so it survives being offline; it only becomes
visible to anyone else (including a manager) once that sync completes.

Defects are the one asymmetric case: a driver can raise and read their own,
but only a manager can change a defect's status (open/acknowledged/resolved)
— enforced by Row-Level Security, not just hidden in the UI, so it's a real
audit trail rather than something a driver could quietly self-close.

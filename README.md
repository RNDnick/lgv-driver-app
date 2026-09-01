# SafeCouple

A mobile-first web app for LGV drivers: a photo-verified trailer coupling/uncoupling
checklist, plus a job & delivery log. Each driver has their own private login;
data is synced to a shared Supabase backend so it isn't stuck on one device.

## Features

- **Connect Trailer (KCALB)** — Kingpin, Clip, Airlines, Legs, Brake. Walks through
  each step with an instruction and a camera capture, so you end up with photo
  evidence for every check.
- **Drop Trailer (BLACK)** — Brake, Legs, Airlines, Clip, Kingpin, in the correct
  order for uncoupling.
- **Job & Delivery Log** — log collection/delivery sites, trailer reg, mileage,
  notes, and capture a proof-of-delivery photo when a job completes.
- **History** — browse past checklist runs and their photos.
- **Offline-safe saves** — every save writes to a local queue first and syncs to
  the backend automatically once you have a signal, so nothing is lost if you're
  in a poor-signal yard when you finish a check.
- **Same-day duplicate photo warning** — each photo is fingerprinted on-device
  (a perceptual hash, not the exact bytes) and compared against your other
  photos from *today only* for that same step. A near-identical match shows a
  warning before you confirm — it doesn't block you, since it's a nudge to
  double-check, not a determination of fraud. Yesterday's brake-on photo
  naturally looks a lot like today's, so only same-day matches are checked.

A checklist run can optionally be linked to an open job.

- **Survives a screen lock mid-checklist** — a phone locking or backgrounding
  the app can discard the page from memory entirely, not just pause it, which
  would otherwise silently wipe an in-progress checklist. Every confirmed step
  is checkpointed to on-device storage immediately, so reopening a Connect/Drop
  Trailer checklist that was interrupted mid-way offers to resume exactly where
  it left off, photos included, instead of losing them.

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

## Backend setup (Supabase)

This app talks directly to a Supabase project (Postgres + Auth + Storage) from
the browser using a public, RLS-protected key — there's no server to run or host.

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL Editor — it creates the
   `profiles`/`jobs`/`checklists` tables, Row-Level Security policies, and the
   private `checklist-photos` storage bucket.
3. In Authentication → URL Configuration, add your deployed URL to the redirect
   allow-list.
4. Put your project's URL and publishable/anon key in `js/supabase-client.js`.
   These are safe to be public — access is enforced by RLS, not by keeping the
   key secret. Never put the `service_role` key here.
5. To make an account a fleet manager (read access to every driver's data),
   set that row's `role` to `'manager'` in the `profiles` table via Supabase's
   Table Editor — there's no in-app UI for this yet.

## Data & privacy

Jobs, checklist records, and photos are stored in your Supabase project,
scoped per driver by Row-Level Security — one driver cannot see another
driver's data, except a `manager`-role account, which can see everyone's.
A save is written to a local on-device queue first and synced to Supabase
in the background, so it survives being offline; it only becomes visible
to anyone else (including a manager) once that sync completes.

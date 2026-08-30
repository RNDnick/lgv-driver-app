# LGV Driver

A mobile-first web app for LGV drivers: a photo-verified trailer coupling/uncoupling
checklist, plus a job & delivery log. Everything is stored locally on the device
(IndexedDB) — no server, no account, works offline once loaded.

## Features

- **Connect Trailer (KCALB)** — Kingpin, Clip, Airlines, Legs, Brake. Walks through
  each step with an instruction and a camera capture, so you end up with photo
  evidence for every check.
- **Drop Trailer (BLACK)** — Brake, Legs, Airlines, Clip, Kingpin, in the correct
  order for uncoupling.
- **Job & Delivery Log** — log collection/delivery sites, trailer reg, mileage,
  notes, and capture a proof-of-delivery photo when a job completes.
- **History** — browse past checklist runs and their photos.

A checklist run can optionally be linked to an open job.

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

## Data & privacy

All jobs, checklist records, and photos are stored in the browser's IndexedDB on
your device only. Nothing is uploaded anywhere. Clearing your browser's site data
for this app will delete everything, so treat it like local storage, not backup.

# Vehicle Service Planner

A mobile-installable PWA for tracking vehicle odometer readings, service intervals, and KM milestones.

## Install on mobile (recommended)

### Option A — GitHub Pages (HTTPS, easiest for install)

1. Push this folder to GitHub
2. Go to **Repository → Settings → Pages**
3. Set source to **main** branch, folder **/ (root)**
4. Open `https://YOUR-USERNAME.github.io/YOUR-REPO/` on your phone
5. **Android:** Tap **Install** in the app banner, or Chrome menu → *Install app*
6. **iPhone:** Safari → Share → *Add to Home Screen*

### Option B — Local network (testing)

1. Double-click **`start-mobile.bat`** (or run `npm run start:mobile`)
2. On your phone (same Wi‑Fi), open the URL shown (e.g. `http://192.168.1.5:3000`)
3. **iPhone:** Safari → Share → *Add to Home Screen* (works on HTTP)
4. **Android:** Install prompt needs **HTTPS** — use GitHub Pages or deploy to Netlify/Vercel for full install

> Do **not** open `index.html` directly from files — the installable app requires a web server.

## Quick start (PC)

```bash
npm start
```

Open `http://localhost:3000`

## Columns

| Column | Description |
|--------|-------------|
| Vehicle Reg No | Registration number |
| Vehicle Model | Make / model |
| Current ODO | Current odometer (KM) |
| Service Interval (KM) | Regular service interval |
| Next Service Due | Next due KM |
| Remaining KM | KM until next service |
| Status | OK · Due Soon (≤ 2,000 KM) · Overdue |
| Milestones | 10k – 300k KM checkpoints |

## Features

- Installable PWA with offline support
- Mobile card layout + desktop table view
- Sort by status (urgent first)
- View mode: Auto / Mobile / Desktop
- Export / import CSV
- Data saved in browser localStorage

## Regenerate icons

```bash
npm run icons
```

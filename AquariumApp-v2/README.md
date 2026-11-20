# Smart Aquarium — Web App v2 (3D)

React 18 + React Three Fiber (Three.js) + Tailwind CSS + Framer Motion + Recharts + Lucide icons.
No build step: libraries load as ES modules from esm.sh / jsDelivr, so the folder can be
dropped onto Netlify as-is.

## Pages
- `login.html` — 3D tank + glass sign-in card (ThingsBoard Cloud login chain from `js/auth.js`)
- `dashboard.html` — interactive 3D tank, real-time monitor, temperature chart, quick controls,
  TinyML AI warning banner, water-low / sensor-fault alerts

## Data
- Live: `js/ws.js` (WebSocket telemetry), `js/rpc.js` (feed RPC), `js/telemetry.js` (validation).
  Tokens are kept in `sessionStorage` only and are never written in the code.
- No simulated data: if the device is offline the header shows "No live data".

## Run locally on Windows
```powershell
cd C:\Users\Administrator\Desktop\AquariumWeb
powershell -ExecutionPolicy Bypass -File .\serve.ps1
```
Open http://localhost:5173/login.html (Ctrl+C in the window to stop).

## Deploy
Netlify → site → Deploys → drag the `AquariumApp-v2` folder onto the drop zone.

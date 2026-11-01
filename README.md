# Cord and Crossing Game

Milestone 1 of the browser-based third-person game described in `GDD.md`.

## Run locally

Requires Node 20 LTS or 22 LTS and npm.

```sh
npm install
npx playwright install chromium
npm run dev
```

Controls: WASD to move, Shift to run, Space to jump, Ctrl or C to dodge, drag to orbit the camera, and scroll to zoom.

## Checks

```sh
npm run typecheck
npm run build
npm test
npm run test:e2e
npm run lint
```

The Vite build writes the static deployment to `dist/` for Vercel.

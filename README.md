# Cord and Crossing Game

Milestone 1 of the browser-based third-person game described in `GDD.md`.

## Run locally

Requires Node 20 LTS or 22 LTS and npm.

```sh
npm install
npx playwright install chromium
npm run dev
```

Controls: click the canvas for mouse look, WASD to move, Shift to run, Space to jump, Ctrl or C to dodge, LMB for the close combo, hold and release RMB for a straight cast, hold RMB plus LMB for the flat arc, Q to recall, and double-tap Q to stop and drop the blade. Walk over a dropped blade to pick it up. Scroll to zoom. In development, middle-mouse drag is the pointer-lock fallback.

## Checks

```sh
npm run typecheck
npm run build
npm test
npm run test:e2e
npm run lint
```

The Vite build writes the static deployment to `dist/` for Vercel.

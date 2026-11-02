# Cord and Crossing Game

Milestone 7, the complete Slice 1 browser game described in `GDD.md`.

## Run locally

Requires Node 20 LTS or 22 LTS and npm.

```sh
npm install
npx playwright install --with-deps chromium
npm run dev
```

Controls: click the canvas for mouse look, WASD to move, Shift to run, Space to jump, Ctrl or C to dodge, LMB for the close combo, hold and release RMB for a straight cast, hold RMB plus LMB for the flat arc, Q to recall, and double-tap Q to stop and drop the blade. E interacts, Tab opens the quest log, F clears an active effect through the heelstones when the prompt is visible, and Esc opens the pause menu. Walk over a dropped blade to pick it up. Scroll to zoom. In development, middle-mouse drag is the pointer-lock fallback and F3 toggles the performance overlay.

The production performance readout is opt-in. Add `?perf=1` to the URL, then use F3 to toggle it. See `PLAYTHROUGH.md` for the complete quest route and laptop validation checklist.

## Checks

```sh
npm run typecheck
npm run build
npm test
npm run test:e2e
npm run lint
```

The Vite build writes the static deployment to `dist/` for Vercel.

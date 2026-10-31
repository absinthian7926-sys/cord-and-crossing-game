# AGENTS.md: rules for Codex (and Astra) on Cord and Crossing Game

Read GDD.md first. It is the source of truth for scope, numbers and milestones.

## Stack (pin these major versions; use the latest minor at install time)
- Node 20 LTS or 22 LTS, npm.
- Vite 6+, TypeScript 5.x with "strict": true.
- React 19, @react-three/fiber 9, @react-three/drei 10, three (latest r17x).
- @react-three/rapier 2 (Rapier physics).
- zustand 5 for state.
- Vitest 3 for unit tests, Playwright for one smoke test.
- ESLint 9 (flat config) + Prettier.
- Deploy target: Vercel static build (`npm run build`, output `dist`).
- Later only: Colyseus (Phase 2), Postgres via Neon (Phase 3). Do not add them before their phase.

## Working rules
1. Build ONE milestone at a time, in the order in GDD.md section 16. Do not start the next milestone until the current one meets every acceptance criterion.
2. Keep the game runnable after every change: `npm run dev`, `npm run build`, `npm test` must all pass.
3. Write tests. Game rules (combat math, cord state machine, effects, crossing detection, quest progression, AI transitions) live in pure TypeScript modules with Vitest tests. Rendering components stay thin.
4. All tunable numbers live in /src/data/*.ts and match GDD.md. If you change a number, update GDD.md in the same commit.
5. Placeholder primitives first. Do not block on art. Real models go in /public/models as compressed GLB.
6. Follow the folder structure in GDD.md section 14.
7. Small commits with clear messages. Summarize what changed and how to test it at the end of each task.
8. Respect the performance budget in GDD.md section 15. Use instancing, avoid per-frame allocations, no React state updates in useFrame hot paths (use refs or zustand transient updates).
9. No secrets in the repo. Use .env.local and Vercel environment variables.
10. Use only CC0 or properly licensed assets and audio; record credits in /public/audio/CREDITS.md and /public/models/CREDITS.md.
11. Writing style for any in-game text or docs: plain English, no em dashes.

## Lore bible summary (do not invent canon)
- Crossing: a matched pair of stones (a portico) holds an upright shimmer screen. A person gains an effect only by a full passage through it ("Both heels clear"). Partial passage gives nothing. A fresh effect needs another full crossing. Rest never grants an effect.
- The screen does not teleport, bridge gaps or carry loads. Porticos are scarce.
- Matched obsidian gives strength. Strength is the only effect in Slice 1.
- Two-effect cap: no one carries more than two active effects (proposed rule; enforce it in code).
- Heelstones: a small matched pair in an iron ring at the hand end of a cord weapon. They never create an effect. They only carry out along the line an effect the bearer already gained by crossing. The pass must be unbroken. Let go of the hand end or cut the cord and the line goes plain at once.
- Cord work is a communal island art of spacing, rhythm, stopping and recovery. Cord weapons are tools first.
- Cord weapons: reachblade (short blade on a cord, Slice 1), ebb dart (cord spear), claw (hook and grapple), sounding weight (weighted cord). Only the reachblade is in Slice 1.
- Conventional arms: swords, bows, crossbows exist. Gunpowder is rare and new; keep it out of Slice 1 entirely.
- Look and feel: weathered coast, fiber rope, iron rings, gray stone, muted wool and linen, dyed cloth as the only bright color. See image links in GDD.md section 11.
- Do NOT use any named Book One characters, manuscript text or plot events. Do not add new lore, places, peoples or magic rules. Anything new must be marked "GAME (NEW)" in GDD.md and kept generic. If unsure, leave a TODO and ask Ryan.

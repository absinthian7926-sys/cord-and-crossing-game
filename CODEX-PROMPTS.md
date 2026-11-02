# Codex prompts for Cord and Crossing Game

## How Ryan starts (one time)

1. On GitHub, create a new empty repository, for example `cord-and-crossing-game` (private is fine). Tick "Add a README".
2. Add three files at the repo root: GDD.md, AGENTS.md, CODEX-PROMPTS.md (use "Add file > Upload files" on GitHub, then Commit).
3. Open Codex (chatgpt.com/codex or the Codex app), connect GitHub if asked, and select the repository.
4. Paste Prompt 1 below and run it. Review the diff, then let Codex open a pull request and merge it.
5. In Vercel, "Add New Project", import the repo, framework preset Vite, Deploy. Each later pull request gets a preview link to play.
6. Run the next prompt only when the previous milestone's acceptance criteria pass on the preview link.
   Astra or another coding agent can use the same prompts; AGENTS.md carries the rules.

## Prompt 1 (Milestone 1: skeleton and movement)

```
Read AGENTS.md and GDD.md in full. Implement Milestone 1 only (GDD section 16, "M1 Skeleton and movement").
Set up Vite + React + TypeScript (strict) + @react-three/fiber + @react-three/drei + @react-three/rapier + zustand + Vitest + Playwright + ESLint + Prettier, using the folder structure in GDD section 14.
Build: a flat test ground, a capsule hero with a Rapier kinematic character controller, the third-person camera from GDD section 5, WASD walk 2.2 m/s, Shift run 5.5 m/s, jump 1.1 m, dodge 4 m over 0.45 s with 0.3 s invulnerability and 0.8 s cooldown, stamina and health with the costs and regen in section 5, and a HUD with health and stamina bars.
Put all numbers in src/data/player.ts. Put stamina and health math in a pure module with Vitest tests. Add a Playwright smoke test that loads the page, finds the canvas, presses W and checks the player position changed (expose a debug hook on window in dev only).
Add npm scripts: dev, build, preview, test, test:e2e, lint. Make sure build, test and lint pass. Add a short README with how to run. Do not start Milestone 2.
```

## Prompt 2 (Milestone 2: reachblade)

```
Read AGENTS.md and GDD.md. Implement Milestone 2 only: the reachblade exactly as GDD section 6.1 to 6.3. Close 3-hit combo, straight cast, flat arc, recall, Stop (double-tap Q), unarmed window with 1.25x damage taken, cord cut and 2.0 s re-tie. Cord states In Hand, Out, Returning, Cut, Dropped in a pure state machine in src/game/weapons/cordState.ts with full Vitest coverage. Render the rope as a 16-point Verlet chain. Add three training dummies that show damage numbers. All numbers in src/data/weapons.ts. Keep everything from M1 working. Do not start Milestone 3.
```

## Prompt 3 (Milestone 3: zone)

```
Read AGENTS.md and GDD.md. Implement Milestone 3 only: the 1 km Saltwind Rise zone from GDD section 4 (locations A to E) with heightmap terrain, sea plane on the west, instanced rocks and scrub, cart road, fixed late afternoon sun. Use placeholder primitives for buildings. Add a dev-only fps and draw-call overlay and meet the Medium performance budget in section 15. Keep the hero and reachblade working in the zone. Do not start Milestone 4.
```

## Prompt 4 (Milestone 4: enemies)

```
Read AGENTS.md and GDD.md. Implement Milestone 4 only: road brigand, brigand archer and cliff hound with stats and behaviors from GDD section 7, AI state machine (Idle, Patrol, Alert, Chase, Attack, Flee, Return) as a pure module with tests, spawn plan and 5 minute respawn, buckler block chance, arrows with visible draw, hound cord-cutter behavior, player death and respawn at the waystation. Numbers in src/data/enemies.ts. Do not start Milestone 5.
```

## Prompt 5 (Milestone 5: quest and NPC)

```
Read AGENTS.md and GDD.md. Implement Milestone 5 only: NPC Hollen at the waystation, dialogue panel, quest log (Tab), quest "The Line at the Rise" steps 1 to 3 and the tracking for 4 to 6 from GDD section 8, camp leader with the key item, and save and load of player and quest state in localStorage. Quest progression as a pure module with tests. Dialogue lines short and plain, no em dashes, no Book One characters or text. Do not start Milestone 6.
```

## Prompt 6 (Milestone 6: portico and heelstones)

```
Read AGENTS.md and GDD.md. Implement Milestone 6 only: the portico at the Ruin Shelf with a shimmer shader, full-crossing detection with two trigger volumes per GDD section 9 (partial or reversed crossing grants nothing), the Strength effect from section 6.4, EffectSystem with a hard cap of 2 effects, scene load into Crossing Hollow (code-split chunk), the heelstone "clear the line" pass on F with the interrupt rule and the line-goes-plain rules, the snag rope post puzzle, the final encounter, and quest steps 4 to 6. Pure modules and tests for crossing detection and effect rules. Do not change any lore rule in AGENTS.md. Do not start Milestone 7.
```

## Prompt 7 (Milestone 7: polish)

Implemented in PR #7.

```
Read AGENTS.md and GDD.md. Implement Milestone 7: replace placeholders with GLB models in /public/models (compressed, credits recorded), Mixamo-style animation clips for idle, run, dodge, strike, cast, recall and heelstone pass, audio per GDD section 12 with credits, pause menu with graphics quality and volume, and a full playthrough check. Confirm the performance budget and fix any blocking bugs. Update GDD.md if any number changed.
```

## Later phase prompts (use after Slice 1 ships)

Phase 2, multiplayer:

```
Read AGENTS.md and GDD.md section 17. Add a Colyseus server in /server (TypeScript) with one room per zone for 20 to 50 players. Server-authoritative movement and combat using the same pure rule modules from /src/game, client prediction and interpolation, shared enemies, simple chat. Add tests for the room state. Keep single-player mode working offline. Document how to run and deploy the server (Vercel cannot host long-lived websockets; propose Fly.io or Railway and wait for Ryan's choice).
```

Phase 3, persistence and more lands:

```
Read AGENTS.md and GDD.md section 17. Add accounts and Postgres (Neon) persistence for characters, effects and quest state. Before adding any new land, weapon or effect, list what you plan to add and which canon or Ryan decision it comes from, then stop and wait for approval.
```

Phase 4, engine evaluation:

```
Read GDD.md. Write ENGINE-EVAL.md comparing staying on R3F with Unity WebGL, Godot web and PlayCanvas for this game, with measured numbers from the current build. Do not migrate code.
```

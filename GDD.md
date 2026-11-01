# Cord and Crossing: Game Design Doc (Slice 1)

Status: GROK-ACCEPTED, REVISABLE, drafted by Absinthian for Ryan Jeter. Oct 31, 2026.
Scope: the first playable slice of a browser 3D open-world game set in the world of "Cord and Crossing". Long-term ambition is a WoW-style online world; this doc builds a small, finished, single-player piece first.

Tags used in this doc:
- CANON: Book One text as cited on the public guide (https://cord-and-crossing.vercel.app).
- SITE: on the public guide as Proposed or GROK-ACCEPTED, not Book One canon.
- GAME (NEW): invented for the game only. Revisable. Never feeds back into the books unless Ryan says so.

No manuscript prose and no Book One plot spoilers appear in the game. Named Book One characters do not appear in Slice 1.

---

## 1. Vision

A third-person, browser-playable open world where the magic is physical and earned: you only gain a power by walking all the way through a crossing screen, and your cord weapon only carries that power if you clear the line through its heelstones. Fights are about range, rhythm and recovery, the island art of cord work turned into survival on the mainland roads.

One-line pitch: "Cross the screen, clear the line, hold the end."

## 2. Pillars

1. Earned magic. Effects come only from full passage through a portico screen (CANON: "Through once. Both heels clear."). No mana bar, no spell list.
2. Two ranges, one weapon. The reachblade is a short sword up close and a thrown blade on a cord at range. Throwing leaves you briefly unarmed (SITE).
3. Stop is a skill. Recovering the cord, calling stop and spacing matter as much as hitting (SITE: stop signal, cord work as communal art).
4. Grounded world. Fiber rope, iron rings, weathered wood, coastal light. Swords, bows, crossbows exist. No gunpowder in Slice 1.
5. Always runnable. Every milestone ships a playable build on Vercel.

## 3. Scope

In (Slice 1, Phase 1):
- One third-person hero (GAME: an original route runner, player-named, default "Runner").
- One zone of about 1 km x 1 km on the mainland coast (cart road country, SITE region "The mainland coast").
- One cord-weapon combo: the reachblade (SITE) with heelstone ring (SITE, decided by Ryan Oct 28, 2026).
- Three enemy types.
- One NPC and one quest.
- One portico crossing that loads a second small area and grants one effect (strength, CANON: matched obsidian gives strength).
- Save to localStorage. Desktop keyboard and mouse. Gamepad optional.

Out (Slice 1):
- Multiplayer, accounts, server persistence (Phases 2 and 3).
- The island, Stoneward Yard, the order, the council and every named Book One character.
- Gunpowder, firearms, ebb dart, claw, sounding weight (later phases).
- Mobile touch controls, voice acting, cutscenes, crafting, inventory beyond a few slots.
- Any manuscript text or Book One plot events.

## 4. World slice

Zone name (GAME): Saltwind Rise, a stretch of coastal cart road above a harbor town's outskirts.

Layout (about 1000 m x 1000 m, heightmap terrain, sea on the west edge):
- A. Waystation (spawn, 0,0 area): rope-and-timber shelter, water barrel, the quest NPC. Safe zone, radius 25 m.
- B. The cart road: winds east 600 m uphill between scrub and rock; two wrecked carts.
- C. Cliff path: north branch along sea cliffs with a rope rail (good for cord play, no climbing system in Slice 1).
- D. Brigand camp: 3 tents, a fire, a lookout post, about 450 m from spawn.
- E. Ruin shelf: a collapsed stone frame shelter at the top of the rise holding a portico pair (GAME placement; portico pairs and frame shelters are CANON concepts). The screen is dormant until the quest step unlocks it.
- F. Crossing Hollow (second small area, about 120 m x 120 m, separate scene loaded after the crossing): a sheltered stone hollow with a practice rail, a target post and a small final encounter.

Time of day: fixed late afternoon in Slice 1 (warm sun low over the sea). Day-night cycle later.

## 5. Player

- Camera: third-person orbit, shoulder offset 0.6 m right, distance 4.5 m (2.5 to 7 m on scroll), collision-aware with 0.2 m clearance and recovery damping 12 after obstruction. GAME (NEW): collision may pull in to 0.3 m when geometry is closer than the scroll minimum.
- Movement: walk 2.2 m/s, run 5.5 m/s (Shift), dodge roll 4 m over 0.45 s with 0.3 s of invulnerability, 0.8 s cooldown. Jump 1.1 m. No climbing in Slice 1.
- Health: 100. Regenerates 4 per second after 6 s without damage.
- Stamina: 100. Run costs 8/s, dodge 25, cord cast 15. Regenerates 20/s after 1 s. After run drains stamina to 0, running re-engages at 10 stamina.
- Death: respawn at waystation or last rested portico area, keep quest state.
- Controls (default): WASD move, mouse look, LMB close strike, RMB hold to aim then release to cast, Q recall line early, Space jump, Ctrl or C dodge, E interact, F clear the line (heelstone pass), Tab quest log, Esc pause.

## 6. Combat: the reachblade

The reachblade (SITE): a forearm-length leaf-shaped single-edged blade with an iron ring pommel, braided cord spliced to the ring, about three to four body lengths of cord. Game cord length: 6.5 m max.

### 6.1 Close mode (blade in hand)
- 3-hit combo on LMB: 14, 14, 22 damage. Windups 0.18 / 0.18 / 0.32 s. Active frames 0.08 s each. Combo window 0.5 s after each hit.
- Hit arc 100 degrees, reach 1.6 m.
- Stamina: 0 for hits 1 and 2, 10 for hit 3.

### 6.2 Cast mode (blade on the cord)
- Straight cast: hold RMB to aim (reticle shows a line to max 6.5 m), release to throw. Travel 22 m/s. Damage 26. Windup 0.25 s.
- Flat arc (hold RMB plus LMB): sweeps 140 degrees at radius 3.5 to 5.5 m, hits up to 3 targets, 18 each. Windup 0.4 s.
- Recall: automatic after hit or max range; manual on Q. Recall time 0.55 s at full length (scales with distance).
- Unarmed window: from release until the blade is back in hand, the player cannot close-strike and takes 1.25x damage. This is the core risk (SITE weakness: "once thrown, the user is briefly unarmed").
- Cord states: Out, Returning, In Hand. Enemies with "cord cutter" tag can cut the line if they hit the cord segment (hitbox capsule along the line); a cut costs 2.0 s to re-tie, during which only unarmed shove (5 damage) is available.
- Stamina: 15 per cast, 20 per arc.
- Interrupt: a cast hit staggers light enemies 0.4 s.

### 6.3 Utility (Slice 1)
- Snag: casting at marked rope posts or loose crates pulls them 2 m (one physics puzzle in Crossing Hollow).
- Stop: tapping Q twice within 0.3 s instantly drops the cord tension and cancels the cast with zero recovery delay, but the blade lands at the current point and must be picked up (walk over it). Teaches "stopping and recovery".
- GAME (NEW): dropped blade pickup radius is 0.8 m and the moving blade hit radius is 0.6 m. The M2 rope simulation uses 16 points, 12 constraint iterations, damping 0.985, gravity 9.81 m/s2, a 0.04 m ground height and a 0.12 m rope hit radius. The visible cut-line stub uses 5 points. Training dummies stand at 3 m, 5 m and 8 m from spawn; the 8 m dummy is the cord-cutter test target with a 0.38 m cutter volume.

### 6.4 Effects and heelstones
- Crossing (CANON): stepping fully through an active portico screen (both feet past the screen plane, tracked by a trigger volume pair) grants the effect. Partial entry grants nothing. A fresh effect needs another full crossing.
- Slice 1 effect: Strength (CANON, matched obsidian). On the player: close damage x1.35, cast pull force x2, stagger duration x1.5. Duration 180 s (GAME number; duration is open in canon).
- Heelstones (SITE, Ryan decided Oct 28, 2026): a small matched pair in the reachblade's ring. They never create an effect. Pressing F while holding an effect plays a 1.2 s "clear the line" animation drawing the cord through the ring. If uninterrupted, the line carries the effect: cast damage x1.35 and casts can break enemy guard. If hit during the pass, nothing carries ("a pass that stops halfway carries nothing").
- The line holds the effect only while the bearer holds the hand end. Cut or dropped cord (Stop) makes the line plain at once.
- Effect cap: maximum 2 active effects (SITE, proposed two-effect cap). Slice 1 only has one, but the code enforces the cap.

### 6.5 Other arms
Swords, bows and crossbows exist (SITE arms notebook). In Slice 1 they appear only on enemies. No gunpowder anywhere.

## 7. Enemies (GAME, generic, no named characters)

| Enemy | HP | Damage | Speed | Behavior | Counterplay |
|---|---|---|---|---|---|
| Road brigand (sword and buckler) | 60 | 12 per hit, 1.1 s cadence | 4.2 m/s | Closes in, blocks frontal casts 50% of the time with buckler | Arc around buckler, or carried strength line breaks guard |
| Brigand archer (short bow) | 40 | 10 per arrow, 2.2 s cadence, 30 m range | 3.5 m/s | Keeps 12 to 25 m away, retreats when approached | Dodge arrows (visible draw 0.6 s), cast from 6 m |
| Cliff hound (wild dog, packs of 2 to 3) | 35 | 8 per bite, 0.8 s | 7 m/s | Flanks, has "cord cutter" tag (bites the line) | Do not over-cast; close combo; stop and recover |

Spawn plan: 6 brigands and 3 archers at the camp, 2 hound packs on the cliff path, 1 mixed patrol on the road. Respawn 5 minutes. Final Hollow encounter: 2 brigands, 1 archer.
AI: simple state machine (Idle, Patrol, Alert, Chase, Attack, Flee at 15% HP for archers, Return). Aggro radius 18 m, leash 40 m.

## 8. Quest (one NPC)

NPC (GAME): Hollen, a waystation keeper and former rigger. Not a Book One character.
Quest (GAME): "The Line at the Rise."
1. Talk to Hollen at the waystation. He says brigands took the iron ring keys for the old frame shelter at the rise.
2. Clear the brigand camp, loot the "frame shelter key" from the camp leader (a brigand variant, 120 HP).
3. Return to Hollen. He teaches the heelstone pass in dialogue (tutorial prompt for F).
4. Go to the Ruin Shelf, use the key, and cross the portico screen. Load Crossing Hollow. Strength is granted.
5. In the Hollow: clear the line through the heelstones, snag the rope post to open the path, defeat the final encounter.
6. Return through the screen (no effect from a return crossing in Slice 1; GAME rule to keep scope small) and report to Hollen. Reward: a dyed cloth tassel cosmetic on the cord (SITE nod to dyed cloth streamers).

Dialogue: short, plain, under 40 words per line, no manuscript prose.

## 9. Portico mechanic (technical)

- Portico: two stone pillars (iron holders, SITE) 2.4 m apart, a vertical shimmer plane between them (shader: soft pale edge, slow vertical ripple; CANON "A bright edge appeared between the stones").
- Crossing detection: two thin trigger volumes, A (front) and B (back), 0.3 m apart from the plane. A crossing counts only if the player capsule enters A, fully passes the plane, and the capsule leaves B on the far side with no part behind the plane. Reversing midway cancels.
- On a valid crossing: grant effect (EffectSystem.add), play 1 s white flash and low chord, then scene transition to Crossing Hollow (loading screen under 2 s target).
- The screen does not teleport, bridge gaps or carry objects (CANON constraint). In game terms the scene load is a fade between two connected spaces, presented as walking on through the shelter.

## 10. UI

- HUD: health and stamina bars bottom-left; effect icons with timers above them (max 2 slots); cord state indicator (In Hand, Out, Cut) next to the crosshair; quest tracker top-right; compass strip top-center.
- Interaction prompt: "E Talk", "E Use key", "F Clear the line".
- Dialogue panel: bottom-center, parchment style, 2 to 4 choices.
- Pause menu: resume, controls, graphics quality (Low, Medium, High), volume, restart.
- Font: a readable serif for titles (e.g. Cormorant Garamond) and a sans for HUD (Inter). Palette taken from the guide site.

## 11. Art direction

- Look: painterly realism, parchment and ink-wash concept language from the guide site, rendered as stylized low-to-mid poly with soft lighting. Think weathered coastal: gray stone, salt-bleached wood, hemp rope, iron rings, muted wool, one accent color from dyed cloth.
- Peoples (SITE, peoples notebook): mainland coast folk in work coats, rolled sleeves, line coiled on the shoulder.
- Style references (public site images):
  - Painted map: https://cord-and-crossing.vercel.app/images/map-painted.jpg
  - Cord weapon lineup: https://cord-and-crossing.vercel.app/images/cw/00-overview-lineup.jpg
  - Peoples lineup: https://cord-and-crossing.vercel.app/images/peoples/00-overview-lineup.jpg
  - Shimmer crossing: https://cord-and-crossing.vercel.app/images/shimmer-crossing.jpg
  - Trade routes: https://cord-and-crossing.vercel.app/images/trade-routes.jpg
  - Island dawn (light and palette): https://cord-and-crossing.vercel.app/images/island-dawn.jpg
  - Guide home: https://cord-and-crossing.vercel.app
- Asset pipeline: placeholder primitives first (capsule hero, boxes, cylinders). Then Tripo or Meshy generated GLB models, rigged and animated with Mixamo, compressed with gltf-transform (Draco or Meshopt, KTX2 textures).

## 12. Audio notes

- Ambient: wind, distant surf, gulls, creaking rope. Waystation: low fire, wood knock.
- Cord: whistle on cast scaled by speed, taut snap at max length, soft rattle on recall, distinct "plain" thud when cut.
- Portico: a low sustained chord near an active screen, rising as the player approaches; bright bell on a valid crossing; nothing on a partial one.
- Heelstone pass: a dry hiss of cord through the ring ending in a small chime when the working end clears.
- Music: sparse strings and wooden flute, combat layer adds drums. Use CC0 or licensed sources only; record source in /public/audio/CREDITS.md.

## 13. Tech architecture

- Build: Vite + TypeScript (strict).
- Render: React Three Fiber (@react-three/fiber) with @react-three/drei. Plain Three.js is allowed for systems that do not need React.
- Physics: Rapier via @react-three/rapier (kinematic character controller for the player).
- State: zustand for game state; pure TypeScript modules for rules (combat math, effects, quest) so they are unit-testable without rendering.
- Tests: Vitest for logic; Playwright smoke test (page loads, canvas renders, player moves).
- Lint and format: ESLint + Prettier.
- Deploy: Vercel (static Vite build). Preview deployment per pull request.
- Later: Colyseus server (Phase 2) with authoritative movement and combat; Postgres (Neon) for persistence (Phase 3).
- Data-driven: enemies, weapons, effects, quest steps and dialogue live in /src/data/*.ts typed constants so numbers in this doc map 1:1 to code.

Core systems: Input, CameraRig, PlayerController, CordWeapon (state machine plus rope rendering via a TubeGeometry or line along a Verlet chain of 16 points), CombatSystem (hitboxes, damage, stagger), EffectSystem (cap 2, durations, carry-on-line flag), PorticoSystem (crossing detection), EnemyAI, QuestSystem, DialogueSystem, SaveSystem, SceneManager (Zone and Hollow), UI (HUD, dialogue, menus), Audio.

## 14. Folder structure

```
/ (repo root)
  GDD.md
  AGENTS.md
  CODEX-PROMPTS.md
  package.json
  vite.config.ts
  tsconfig.json
  index.html
  /public
    /models  /textures  /audio (CREDITS.md)
  /src
    main.tsx
    App.tsx
    /game
      /scenes        Zone.tsx, Hollow.tsx, SceneManager.ts
      /player        PlayerController.tsx, CameraRig.tsx, input.ts
      /weapons       CordWeapon.tsx, cordState.ts, verletRope.ts
      /combat        combat.ts, hitboxes.ts
      /effects       effects.ts
      /portico       Portico.tsx, crossing.ts
      /enemies       Enemy.tsx, ai.ts
      /quest         quest.ts, dialogue.ts
      /save          save.ts
      /audio         audio.ts
    /ui              Hud.tsx, Dialogue.tsx, PauseMenu.tsx
    /data            weapons.ts, enemies.ts, effects.ts, quests.ts, dialogue.ts
    /test            *.test.ts
  /e2e               smoke.spec.ts
```

## 15. Performance budget

- Target: 60 fps on a 2020 laptop with integrated graphics at Medium; 30 fps floor on Low.
- Draw calls under 250; triangles on screen under 500k; textures under 150 MB GPU.
- Initial download under 15 MB gzip; Hollow scene chunk under 5 MB; first playable under 8 s on 50 Mbps.
- JS main bundle under 1.5 MB gzip. Physics step fixed 60 Hz.
- Instancing for rocks, grass and scrub; LOD for terrain chunks; shadows only from sun, 2048 map on High.

## 16. Milestones and acceptance criteria

Build one milestone at a time. Each ends with a runnable build, passing tests and a Vercel preview.

M0 Docs (done when): GDD.md, AGENTS.md, CODEX-PROMPTS.md at repo root.

M1 Skeleton and movement
- Vite + TS + R3F + Rapier project runs with `npm run dev`; deploys to Vercel.
- Flat test ground, capsule hero, third-person camera, WASD, run, jump, dodge with the numbers in section 5.
- HUD shows health and stamina. Vitest passes for stamina math. Playwright smoke test passes.

M2 Reachblade
- Close combo, straight cast, flat arc, recall, stop, unarmed window, cord cut and re-tie as in section 6, against training dummies.
- Rope renders as a Verlet chain. Damage numbers match /src/data/weapons.ts. Unit tests for cord state machine and damage.

M3 Zone
- 1 km heightmap terrain with the A to E locations, sea plane, instanced scenery, fixed late afternoon light. Meets performance budget on Medium.

M4 Enemies
- Three enemy types with stats and AI from section 7, spawns and respawn, death, player respawn. Tests for AI state transitions.

M5 Quest and NPC
- Hollen, dialogue panel, quest log, all 6 steps trackable, key item, save and load via localStorage. Tests for quest progression.

M6 Portico and heelstones
- Portico shimmer shader, full-crossing detection (partial does nothing), Strength effect, scene load to Crossing Hollow, heelstone pass with interrupt rule, effect cap 2. Tests for crossing detection and effect rules.

M7 Polish and slice complete
- Placeholder models swapped for GLB assets, audio pass, pause menu, settings. Full quest playable start to finish in 15 to 25 minutes with no blocking bugs.

## 17. Later phases

- Phase 2, multiplayer: Colyseus room per zone, 20 to 50 players, server-authoritative positions and hits, client prediction and interpolation, shared enemies, chat.
- Phase 3, persistence and more lands: accounts, Postgres characters and quest state, new zones (coastal mountain roads, inland hills), ebb dart, claw and sounding weight, bows and crossbows for players, more effects only from canon or Ryan's decisions.
- Phase 4, optional engine upgrade: evaluate moving to Unity WebGL, Godot web export or PlayCanvas if browser limits block the vision. Data files and rules modules should port.

## 18. Open questions for Ryan

1. Is a mainland coast starting zone right, or should the first slice be the island (which has no combat tradition in canon)?
2. Strength duration of 180 s and the "no effect on return crossing" rule are game-only numbers. Keep?
3. Hero: original route runner, or a choice of peoples at character creation later?

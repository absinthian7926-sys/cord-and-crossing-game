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

M3 implementation defaults (all GAME (NEW), revisable):

- Coordinates use +X east, -Z north and +Y up. The 1000 m square runs from X -150 to 850 and Z -500 to 500, putting the west coast about 150 m from the waystation while leaving room for the 600 m road. Spawn is (0, 8, 0).
- The heightmap is a deterministic 257 x 257 grid with seed 1, 64-cell chunks, 2 LOD levels and a 260 m LOD switch. Maximum height is 60 m. The waystation, camp and Ruin Shelf flatten to about 8 m, 38 m and 58 m. Noise uses scales 95 m and 31 m with amplitudes 3.5 m and 1.1 m.
- Sea level is 0. The coast begins at X -150 and blends to the plateau by X -75. The sea plane is 500 m wide and 1200 m deep.
- Location centers and scatter-exclusion radii are A (0, 0), 25 m; B (300, -55), 12 m; C (0, -190), 24 m; D (380, -240), 55 m; and E (600, -80), 42 m.
- The road is 6 m wide, drawn 0.04 m above terrain, flattened across 13 m and excludes scatter within 9 m. It is sampled every 3 m through control points (0, 0), (75, -8), (150, -28), (230, -15), (310, -70), (390, -120), (490, -95) and (600, -80). Wrecked carts sit about 200 m and 400 m along it.
- The cliff path is 3 m wide through points (120, -30), (70, -95), (25, -160), (-20, -225) and (-65, -280). Its rope rail is 1.1 m high with posts every 8 m; rail posts use 0.1 m radius and the rope sits at 0.9 m.
- Medium scatter uses seed 11 for 2500 rocks across 3 variants and seed 29 for 6000 scrub across 2 variants. Low density is 0.5x, Medium 1x and High 1.5x. Rock scale ranges from 0.35 to 2.2 and scrub from 0.35 to 1.15. Rocks at least 1.5 m scale within 10 m of a road or path may receive simple colliders.
- Quality defaults to Medium. Low, Medium and High draw distances are 450 m, 650 m and 850 m. Fixed fog starts at 150 m and ends at 600 m, using color #91a3a4. Sun shadow maps are 1024 on Low and Medium and 2048 on High. Quality changes only shadow map size, scatter density and draw distance.
- The fixed sun points from west-southwest with normalized direction (-0.933, 0.259, 0.25), color #ffc98a and intensity 2.4. Hemisphere fill intensity is 0.7. The moving shadow camera covers 90 m around the player, follows across 160 m and uses bias -0.0005.
- Falling or leaving the 1000 m bounds resets after 1 s when 5 m below terrain or 1.5 m into the sea. Boundary walls are 80 m high and 2 m thick.
- The M3 inert portico pillars were 2.4 m apart and 3.2 m high. M6 replaces those forms with the active portico described in section 9. The waystation shelter is 8 x 3.2 x 5 m centered at (-7, 3), uses 0.16 m posts, and has a 0.5 m radius by 1.2 m barrel at offset (4, 2). Its PLACEHOLDER NPC marker is a flat 0.6 m disc at offset (2, 2), with no person, interaction or gameplay.
- Placeholder carts use a 3.2 x 0.7 x 1.6 m body with 0.48 m radius by 0.22 m wheels. Camp tents use 6 x 3.2 x 4 m forms at offsets (-10, 0), (8, -5) and (2, 10). The static fire radius is 0.8 m with glow range 12 m. The lookout is 3 x 6 x 3 m at offset (14, -12).
- Ruin frame posts use 1.4 x 4 x 1.4 m forms at offsets (-6, 0), (6, 0) and (0, 5), with a 13 x 0.8 x 1.4 m lintel. The inert portico center is (600, -80) and its pillar forms are 0.7 x 3.2 x 0.7 m.
- The dev performance overlay samples every 0.25 s and toggles with F3. Palette values are terrain #6f735f, road #725f45, sea #557981, rocks #686b66 / #77766d / #595f5d, scrub #6d7657 / #7c7657, wood #8b7658, rope #a48a5e, stone #777873, tent #82745f, fire #d98245 and NPC marker #b8aa82.

M6 Crossing Hollow defaults (all GAME (NEW), revisable):

- Crossing Hollow is a flat 120 m square from X and Z -60 to 60 at ground height 0, with ground color #5f625b. Its return portico is centered at (0, 0) with screen normal (0, 0, 1). Arrival and the Hollow death respawn point are (0, 0, -3).
- The PLACEHOLDER practice rail is at (-6, -11), the target post at (7, -12), the marked snag post at (0, -30), the 3 m blocked gap at the snag post, and the final encounter center at (0, -55). Final-enemy offsets are (-4, 0), (4, 0) and (0, -3), keeping every body inside the Hollow walls.
- PLACEHOLDER Hollow forms are low-poly primitives. The practice rail uses 1.5 m posts at X offsets -1.5 and 1.5 with 0.09 to 0.11 m radii, a 3 m rope at height 1.25 m and radius 0.045 m. The target uses a 2 m post with 0.13 to 0.16 m radii and a 0.45 m radius by 0.12 m target. The snag post uses a 1.6 m form with 0.22 to 0.28 m radii and a 0.27 m ring with 0.05 m tube. The temporary gate is 3 m wide, 3 m high and 0.6 m thick, with permanent stone shoulders reaching the side bounds so the gate is the only route. Visible perimeter shelter walls are 4 m high and 1 m thick.
- PLACEHOLDER Hollow lighting uses ambient intensity 0.65 and a warm directional light at (-35, 22, 18) with intensity 1.6. Fog starts at 54 m and ends at 120 m. Final encounter ground markers use 0.35 m radius with 10 segments, and the ground collider is 0.25 m deep.

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

- Snag: casting at marked rope posts or loose crates pulls them 2 m (one physics puzzle in Crossing Hollow). GAME (NEW): the M6 marked post moves at a base 2 m/s; Strength doubles only that speed, not the 2 m distance. Ryan confirmed this rule on 2026-11-02.
- Stop: tapping Q twice within 0.3 s instantly drops the cord tension and cancels the cast with zero recovery delay, but the blade lands at the current point and must be picked up (walk over it). Teaches "stopping and recovery".
- A dropped blade remains in the scene where it landed and does not cross a portico with the player. The player stays unarmed in the other scene until returning to pick it up.
- GAME (NEW): dropped blade pickup radius is 0.8 m and the moving blade hit radius is 0.6 m. The M2 rope simulation uses 16 points, 12 constraint iterations, damping 0.985, gravity 9.81 m/s2, a 0.04 m ground offset and a 0.12 m rope hit radius. The visible cut-line stub uses 5 points. Training dummies stand about 3 m, 5.2 m and 5.95 m from spawn; the 5.95 m dummy is the cord-cutter test target with a 0.38 m cutter volume.

### 6.4 Effects and heelstones

- Crossing (CANON): stepping fully through an active portico screen (both feet past the screen plane, tracked by a trigger volume pair) grants the effect. Partial entry grants nothing. A fresh effect needs another full crossing.
- Slice 1 effect: Strength (CANON, matched obsidian). On the player: close damage x1.35, cast pull force x2, stagger duration x1.5. Duration 180 s (GAME, decided by Ryan on 2026-11-02, GDD 18 question 2).
- Heelstones (SITE, Ryan decided Oct 28, 2026): a small matched pair in the reachblade's ring. They never create an effect. Pressing F while holding an effect plays a 1.2 s "clear the line" animation drawing the cord through the ring. If uninterrupted, the line carries the effect: cast damage x1.35 and casts can break enemy guard. If hit during the pass, nothing carries ("a pass that stops halfway carries nothing").
- The line holds the effect only while the bearer holds the hand end. Cut or dropped cord (Stop) makes the line plain at once.
- Effect cap: maximum 2 active effects (SITE, proposed two-effect cap). Slice 1 only has one, but the code enforces the cap.

M6 implementation defaults (all GAME (NEW), revisable unless marked otherwise):

- Re-adding Strength refreshes its timer to the full configured duration and does not stack. Effects and the carried line are not saved. Reload and death clear both (Ryan confirmed 2026-11-02).
- The heelstone pass requires the blade In Hand. During its 1.2 s the player may turn but cannot move, strike, cast or dodge. Damage interrupts it. Dodge input cancels it with nothing carried. It has no stamina cost. Ryan confirmed the 1.2 s duration and dodge-cancel rule on 2026-11-02.
- A carried line remains carried through normal cast and recall while Strength remains active. Cut, Stop, Strength expiry or removal, and player death make it plain at once.

### 6.5 Other arms

Swords, bows and crossbows exist (SITE arms notebook). In Slice 1 they appear only on enemies. No gunpowder anywhere.

## 7. Enemies (GAME, generic, no named characters)

| Enemy                                   | HP  | Damage                                  | Speed   | Behavior                                                     | Counterplay                                               |
| --------------------------------------- | --- | --------------------------------------- | ------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| Road brigand (sword and buckler)        | 60  | 12 per hit, 1.1 s cadence               | 4.2 m/s | Closes in, blocks frontal casts 50% of the time with buckler | Arc around buckler, or carried strength line breaks guard |
| Brigand archer (short bow)              | 40  | 10 per arrow, 2.2 s cadence, 30 m range | 3.5 m/s | Keeps 12 to 25 m away, retreats when approached              | Dodge arrows (visible draw 0.6 s), cast from 6 m          |
| Cliff hound (wild dog, packs of 2 to 3) | 35  | 8 per bite, 0.8 s                       | 7 m/s   | Flanks, has "cord cutter" tag (bites the line)               | Do not over-cast; close combo; stop and recover           |

Spawn plan: 6 brigands and 3 archers at the camp, 2 hound packs on the cliff path, 1 mixed patrol on the road. Respawn 5 minutes. Final Hollow encounter: 2 brigands, 1 archer.
AI: simple state machine (Idle, Patrol, Alert, Chase, Attack, Flee at 15% HP for archers, Return). Aggro radius 18 m, leash 40 m.

M4 implementation defaults (all GAME (NEW), revisable):

- Placeholder Road brigand and Brigand archer bodies use capsules with 0.4 m radius and 1.8 m height. Their placeholder colors are #655c50 and #8b8170. Cliff hounds use low capsules with 0.3 m radius, 0.9 m length and color #665e4d.
- Road brigand attack reach is 1.8 m and Cliff hound bite reach is 1.4 m. Archers and hounds are light enemies and take the existing 0.4 s cast stagger. Road brigands stagger only on close combo hit 3. Bucklers block 50% of straight casts inside a 90 degree frontal cone. Arc hits never block. The `breaksGuard` hit flag exists but defaults false in M4.
- Arrows travel at 35 m/s with 9.81 m/s2 gravity, use a 0.15 m hit radius, draw from a fixed pool of 16 and despawn after 2 s, after 30 m or on terrain impact. They release 0.45 m above the archer center, aim at the player's current position with no lead and use the lower ballistic arc that compensates for gravity.
- A Cliff hound in Attack within its 1.4 m bite reach checks all 15 segments of the simulated 16-point Verlet rope on its 0.8 s bite cadence. Its cutter volume radius is 0.38 m and is centered at the top of the low hound capsule. The overlap includes the rope's 0.12 m hit radius. A bite overlapping the simulated cord while it is Out produces one cut through the existing cut and re-tie path.
- Patrol movement is 50% of chase speed. Each patrol uses 3 or 4 points within 15 m of its anchor. The mixed road patrol has 2 Road brigands and 1 Brigand archer between road distances 150 m and 350 m. Its 40 m leash is measured from the nearest point on that route corridor so the patrol can traverse both endpoints.
- The camp spawn anchor is (380, -240) with enemies spread within 30 m. Cliff hound pack anchors are (25, -160) with 3 hounds and (-20, -225) with 2 hounds.
- Alert lasts 0.6 s before Chase. Return restores full health when an enemy is within 1 m of its anchor. Line of sight uses one physics ray against terrain and large rocks.
- Enemies ignore a player inside the 25 m waystation safe zone and Return if the player is there. Enemy bodies, arrows and all sensors are excluded from the camera ray. Terrain, large rocks and buildings remain camera blockers.
- Player death uses a 1.5 s placeholder fade, then respawns at (0, 8, 0) with full health and stamina, 2 s spawn invulnerability and the cord In Hand. On death, living enemies within 40 m of the death position reset to Return, inclusive at exactly 40 m. Enemies farther away keep their current state and follow their normal no-target behavior without a forced Return or heal. The 40 m reset radius is GAME (NEW) and matches the leash.
- Enemy death uses a 1.0 s placeholder fall before removal. Respawn is scheduled after 300 s and waits until the player is more than 40 m from the anchor. A small PLACEHOLDER world-space health bar is shown for 4 s after damage.
- Road brigand attacks have a 0.5 s windup and Cliff hound bites have a 0.35 s windup, both GAME (NEW) and inside their existing cadence. Damage, and a hound cord cut, resolve only at the windup end if the target is still within reach. Dodge invulnerability at impact prevents damage. Moving out of reach or staggering the attacker during the windup cancels the attack. The PLACEHOLDER telegraph rotates the brigand sword 90 degrees, scales the hound to 0.65 on Y, and tints the attacker #c9a46a. These presentation values are GAME (NEW).
- PLACEHOLDER presentation numbers are GAME (NEW): the arrow mesh is 0.025 m by 0.025 m by 0.65 m, color #5e4b35 and roughness 0.9. Stagger feedback wobbles at angular frequency 80 with maximum rotation 0.09 radians. The Cliff hound body mesh uses 6 cap and 10 radial segments at roughness 0.95, with a head cone at (0, 0.08, -0.48), radius 0.22 m, length 0.42 m and 6 segments. Humanoid body meshes use 8 cap and 12 radial segments at roughness 0.9. The Road brigand sword is at (0.5, 0, 0), size (0.08, 1.05, 0.12), color #6a6b68 and metalness 0.45. Its buckler is at (-0.5, 0.1, 0), radius 0.34 m, depth 0.1 m, 10 segments, color #5d5a50 and metalness 0.35. The archer bow is at (0.46, 0.1, 0), radius 0.38 m, tube radius 0.035 m, 6 radial and 16 tubular segments, color #7a6044 and roughness 0.9. Its draw bar is 0.7 m by 0.06 m by 0.06 m at y 0.88 m, color #d2b984, with minimum horizontal scale 0.02. The health bar sits 0.8 m above the body, with a 0.9 m by 0.1 m #28251f background at depth 0.01 m and a 0.84 m by 0.065 m #9f493e fill at depth 0.02 m.
- M5 keeps the existing M4 choices for placeholder palette and proportions, archer draw in the final 0.6 s of the cadence, lower ballistic arc, 1 m Return tolerance, road patrol corridor leash, buildings blocking line of sight, and deterministic flank and patrol order.

## 8. Quest (one NPC)

NPC (GAME): Hollen, a waystation keeper and former rigger. Not a Book One character.
Quest (GAME): "The Line at the Rise."

1. Talk to Hollen at the waystation. He says brigands took the iron ring keys for the old frame shelter at the rise.
2. Clear the brigand camp, loot the "frame shelter key" from the camp leader (a brigand variant, 120 HP).
3. Return to Hollen. He teaches the heelstone pass in dialogue (tutorial prompt for F).
4. Go to the Ruin Shelf, use the key, and cross the portico screen. Load Crossing Hollow. Strength is granted.
5. In the Hollow: clear the line through the heelstones, snag the rope post to open the path, defeat the final encounter.
6. Return through the screen (no effect from a return crossing in Slice 1; GAME, decided by Ryan on 2026-11-02) and report to Hollen. Reward: a dyed cloth tassel cosmetic on the cord (SITE nod to dyed cloth streamers).

Dialogue: short, plain, under 40 words per line, no manuscript prose.

M5 implementation defaults (all GAME (NEW), revisable):

- Hollen uses a PLACEHOLDER capsule with radius 0.4 m, height 1.8 m and muted linen color #b8aa82. He stands at (-5, 5), faces the road toward (0, 0), turns toward the player while talking and has a 2.5 m interaction radius.
- The exact interaction prompts are PLACEHOLDER text: "E Talk" for Hollen and "E Take key" for the dropped key. M5 adds no key-use action and no working heelstone-pass action.
- The camp leader is a Road brigand variant with 120 HP and the Road brigand's existing damage, cadence, 0.5 s windup, speed, buckler, stagger and no-flee rules. Its PLACEHOLDER capsule and collider are 1.15x Road brigand scale, it stands at offset (0, 4) from the camp center, and a dyed sash in #9f493e is its only bright color. It spawns from quest step 2 until defeated, drops the key at its death position and does not respawn while the key is waiting or after it is looted. The optional PLACEHOLDER label is "Camp leader".
- The frame shelter key is a plain iron ring. Its PLACEHOLDER pickup uses a 1.5 m interaction radius, 0.18 m ring radius, 0.035 m tube radius, 6 radial and 16 tubular segments, iron color #5d5a50, metalness 0.65, roughness 0.5, and a soft #c9a46a glow with intensity 0.4 and range 2 m. It cannot be dropped or lost. Step 2 completes when the key is picked up, without requiring every camp enemy to be defeated.
- The dialogue panel is at most 640 px wide with parchment #e8dcc0 and ink #2b2620. It shows 2 to 4 numbered choices. The quest tracker uses 14 px text and highlights a changed step for 3 s. The quest log has one key slot, shows all six steps, marks completed steps and highlights the current step.
- M5 used save key `cord-and-crossing.save.v1` with schema version 1. M6 migrates a valid v1 record to the v2 rules below.
- Steps 4 to 6 are defined in the quest data and may advance through the dev hook for tests, but M5 gameplay emits events only for steps 1 to 3. No portico, crossing, Hollow, effect or reward behavior exists in M5.
- The exact PLACEHOLDER tracker text is GAME (NEW): "Talk to Hollen."; "Clear the brigand camp and take the frame shelter key."; "Return to Hollen."; "Go to the Ruin Shelf, use the key, and cross the portico screen."; "Clear the line, snag the rope post, and defeat the final encounter."; and "Return through the screen and report to Hollen."
- The exact PLACEHOLDER Hollen dialogue lines are GAME (NEW): "Brigands took the iron ring keys for the old frame shelter at the rise."; "The frame shelter key is at the brigand camp."; "Once you carry an effect, press F to clear the line through the heelstones."; "Take the key to the Ruin Shelf and cross the portico screen."; "Clear the line, snag the rope post, and defeat the final encounter in the Hollow."; and "Report when you return through the screen."
- The exact PLACEHOLDER dialogue choices are GAME (NEW): "I will bring one back."; "Leave"; "I am looking for it."; "I understand."; "Say that again."; "I will go to the shelf."; "I know the work."; and "The work is finished."

M6 quest and save defaults (all GAME (NEW), revisable):

- The save key is `cord-and-crossing.save.v2` with schema version 2. A valid v1 save from `cord-and-crossing.save.v1` migrates on load. The v2 record adds the exact pending key-drop position or null, permanent portico-unlocked state, current scene, Hollow pass / snag / encounter progress, and tassel-earned state. Clearing a save removes both keys.
- A migrated v1 save that defeated the camp leader before taking the key uses the prior camp-leader anchor as its legacy key-drop fallback because v1 did not store the exact death point. Every new v2 key drop stores and restores the exact point (Ryan approved 2026-11-02).
- Autosave still runs on every quest revision, every persistent portico, scene or Hollow-progress change, every 30 s while alive, and page hide. A living player restores a valid position in the saved scene. Zone fallback is (0, 8, 0); Hollow fallback is (0, 0, -3). Effects and the carried line load empty, and the cord loads In Hand.
- The key is kept after use and the portico stays unlocked (Ryan confirmed 2026-11-02). Quest step 5 completes only after one heelstone pass has completed in the Hollow, the marked post has been pulled and all three final enemies have been defeated. The two Road brigands and one Brigand archer do not respawn after defeat.
- Reporting at step 6 completes the quest, grants the tassel once and autosaves. Reporting at steps 1 to 5 or after completion changes nothing. The PLACEHOLDER completion line is "The work at the rise is done." The added PLACEHOLDER choice is "Say that again."; "Leave" is reused.
- The PLACEHOLDER tassel is a 0.25 m by 0.06 m by 0.025 m cloth strip at blade-ring offset (0, -0.56, 0), color #9f493e and roughness 0.9. It has no gameplay effect.

## 9. Portico mechanic (technical)

- Portico: two stone pillars (iron holders, SITE) 2.4 m apart, a vertical shimmer plane between them (shader: soft pale edge, slow vertical ripple; CANON "A bright edge appeared between the stones").
- Crossing detection: two thin trigger volumes, A (front) and B (back), 0.3 m apart from the plane. A crossing counts only if the player capsule enters A, fully passes the plane, and the capsule leaves B on the far side with no part behind the plane. Reversing midway cancels.
- On a valid crossing: grant effect (EffectSystem.add), play a 1 s white flash, then scene transition to Crossing Hollow (loading screen under 2 s target). Audio remains M7 and no chord plays in M6.
- The screen does not teleport, bridge gaps or carry objects (CANON constraint). In game terms the scene load is a fade between two connected spaces, presented as walking on through the shelter.

M6 portico defaults (all GAME (NEW), revisable):

- The zone portico is centered at (600, -80), with its front facing west and screen normal (-1, 0, 0). The key-use radius is 2.5 m on the zone side. "E Use key" appears only at quest step 4 with the key while the screen is locked. The key is not consumed. Returning from the Hollow places the player 3 m west of the screen on the zone side.
- The screen is 2.4 m wide, 3.2 m high and 0.04 m thick. Trigger centers are 0.3 m from the plane and trigger depth is 0.12 m. Solid pillars remain camera blockers; all key-use and crossing sensors are excluded from camera rays.
- The PLACEHOLDER shimmer uses pale edge #e9efe6, a 0.25 m soft edge, 0.3 m/s vertical ripple, opacity 0.45 and a 1 s fade on unlock. Its cheap shader uses ripple frequency 34, horizontal phase 5, body alpha 0.12 plus ripple alpha 0.16, and edge contribution 0.78. It is one draw call with no downloaded texture or post-processing. A dev performance sample counts it as in view only when its center is inside the camera frustum and the absolute camera-to-screen normal dot is at least 0.5.
- The crossing flash lasts 1 s. The loading panel says "Crossing Hollow" and contains no lore text. The return screen is always active. With Ryan's 2026-11-02 rule, a Hollow-to-zone return crossing does not add or refresh Strength.

## 10. UI

- HUD: health and stamina bars bottom-left; effect icons with timers above them (max 2 slots); cord state indicator (In Hand, Out, Cut) next to the crosshair; quest tracker top-right; compass strip top-center.
- Interaction prompt: "E Talk", "E Use key", "F Clear the line".
- Dialogue panel: bottom-center, parchment style, 2 to 4 choices.
- Pause menu: resume, controls, graphics quality (Low, Medium, High), volume, restart.
- Font: a readable serif for titles (e.g. Cormorant Garamond) and a sans for HUD (Inter). Palette taken from the guide site.

M6 UI implementation (GAME (NEW), revisable): effect slots sit above the existing vitals and are sampled at 10 Hz with whole-second timers. The exact M6 action prompts are "E Use key" and "F Clear the line". The PLACEHOLDER loading panel uses the existing parchment and ink colors with the text "Crossing Hollow". M6 adds no compass, pause menu, settings UI or downloaded web fonts; those remain M7.

M7 settings defaults (all GAME (NEW), revisable):

- Settings use schema version 1 under `cord-and-crossing.settings.v1`, separate from the game save. Writes are debounced 250 ms. The saved fields are the four volume values, quality, whether quality was chosen by hand, reduce motion, whether reduce motion was chosen by hand, mouse sensitivity and invert Y.
- Quality defaults to Medium. Mouse sensitivity ranges from 0.5x to 2.0x and defaults to 1.0x. Invert Y defaults off. Reduce motion follows `prefers-reduced-motion` until the player chooses it by hand.
- Low, Medium and High apply live. Their device pixel ratios are 1, [1, 1.5] and [1, 2]. Restart keeps settings.
- The compass is 360 px wide, shows a 120 degree span and samples transient heading and marker data at 10 Hz.
- The PLACEHOLDER title shows "Cord and Crossing", save-aware "Continue", "New game" and "Credits" actions over the rendered world. The pause root contains "Resume", "Controls", "Graphics", "Volume", "Restart" and "Credits". Restart asks: "Restart the quest from the beginning? Your saved progress will be cleared." with "Restart" and "Cancel".
- Pause freezes fixed-step physics and the shared gameplay clock. Escape closes dialogue or the quest log first, otherwise toggles pause. Pointer-lock loss during active play opens pause. A pause requested during a crossing flash, scene load or death fade opens after that blocker clears.
- M7 credits are exactly: "Cord and Crossing"; "Co-developed with AI by RJ and Absinthian."; "Design and direction: RJ"; "Models: made for this project with Blender scripts and code (CC0)."; "Audio: generated in code for this project (CC0)."; and "Built with open-source software: Blender, Vite, React, three.js, React Three Fiber, drei, Rapier, zustand, postprocessing. See each project's license."
- M7 uses system fonts only: Georgia, `Times New Roman`, serif for titles and system-ui, `-apple-system`, `Segoe UI`, sans-serif for HUD and menus. No web font is downloaded.

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
- Slice 1 asset pipeline, decided by Ryan on 2026-11-02: self-authored Blender scripts are the primary free pipeline, with deterministic code-built GLBs as the fallback when Blender is unavailable. M7 used the authorized code-built fallback because Blender was not present in the development environment. Source lives in `scripts/models`, compression uses weld, dedup, prune, quantize and Meshopt, and the flat-color assets use no textures. The existing primitives remain runtime fallbacks.

M7 model defaults (all GAME (NEW), PLACEHOLDER art and revisable):

- Each model has at most 4 materials and no downloaded textures. Hero is at most 3000 triangles. Road brigand, Brigand archer and Hollen are at most 2500 each. Cliff hound is at most 1500. Each static prop is at most 1500.
- Hero clips are idle 2 s, run 0.7 s, dodge 0.45 s, strike 1 and 2 at 0.5 s, strike 3 at 0.64 s, cast 0.5 s, recall 0.55 s and heelstone pass 1.2 s. Walk uses run at 0.4x. The animation crossfade is 0.12 s.
- Road brigand clips are idle 2 s, walk 0.8 s, attack 1.1 s, stagger 0.4 s and death 1 s. Brigand archer clips are idle 2 s, walk 0.8 s, draw 0.6 s and death 1 s. Cliff hound clips are idle 1.6 s, run 0.55 s, bite 0.8 s and death 1 s. Hollen clips are idle 2 s and talk 1.5 s.
- Static model ids are waystation shelter, water barrel, cart, tent, camp fire, lookout, ruin frame post, ruin lintel, portico pillar, rope rail post, frame shelter key, practice rail, target post, snag post, Hollow gate and tassel. Rope rail posts remain instanced primitives in the world to keep their one-draw-call budget, while the generated model remains available.
- The M7 code-built outputs total 103816 bytes. The largest file is `hero.glb` at 13128 bytes. All outputs are dedicated CC0 by the project and recorded in `public/models/CREDITS.md`.

## 12. Audio notes

- Ambient: wind, distant surf, gulls, creaking rope. Waystation: low fire, wood knock.
- Cord: whistle on cast scaled by speed, taut snap at max length, soft rattle on recall, distinct "plain" thud when cut.
- Portico: a low sustained chord near an active screen, rising as the player approaches; bright bell on a valid crossing; nothing on a partial one.
- Heelstone pass: a dry hiss of cord through the ring ending in a small chime when the working end clears.
- Music: sparse strings and wooden flute, combat layer adds drums. Use CC0 or licensed sources only; record source in /public/audio/CREDITS.md.

M7 procedural audio defaults (all GAME (NEW), PLACEHOLDER and revisable):

- All Slice 1 audio is synthesized at runtime. The lazy engine has 24 voices. Master, music, SFX and ambient sliders default to 80, 50, 80 and 60 and use the squared gain curve `(value / 100)^2`. The master compressor threshold is -12 dB with ratio 3.
- A crossing bell ducks music 6 dB for 1.5 s. Pause filters music and ambience at 800 Hz and reduces both 9 dB over 0.3 s. The open filter is 20 kHz.
- Zone wind uses a 0.07 Hz gain LFO. Surf swells every 6 to 9 s, is full at X = -150, falls to 25 percent at X = 300 and stays there farther east. Gulls occur every 8 to 20 s within 250 m of the west coast. Rope creaks occur every 5 to 12 s within 15 m of the rail or shelter. Waystation fire and wood are heard within 25 m. Hollow wind is 40 percent, surf is 15 percent and gulls are absent.
- Cord whistle pitch maps blade speed 0 to 22 m/s onto 0.8x to 1.2x. The maximum-length snap is at 6.5 m. Portico sound is silent beyond 20 m and full at 2 m, with pitch rising 2 semitones and the low-pass opening from 400 Hz to 2000 Hz across that range.
- Heelstone hiss follows the 1.2 s pass and chimes only on completion. Music uses seed 7, 72 bpm and D dorian, with phrases of 2 to 4 notes, rests of 4 to 12 beats, 5 Hz flute vibrato, 2 s combat entry, 6 s combat exit and 2 s crossfades.
- Footsteps are 0.5 s apart at walk speed and 0.32 s apart at run speed, gain 0.35, with seeded pitch variation within 4 percent. Dirt is filtered at 1200 Hz. Stone uses a 2500 Hz band and 180 Hz body. The Ruin Shelf stone radius is 42 m.
- Flesh hits use a 220 Hz body for 0.12 s. Buckler blocks use 880 Hz and 1320 Hz partials for 0.2 s. Player hurt uses a 140 Hz body for 0.15 s. Strike 3 gain is 1.15x. Guard-break block pitch is 3 semitones lower and is followed by the flesh hit.
- Engine synthesis uses 12 semitones per octave, a 64-event bus, 20-cue history, a 2 s generated noise buffer, maximum update delta 0.25 s and 0.03 s bus ramps. General envelopes use silence gain 0.0001, 0.08 s target ramps, 0.015 s attacks at 20 percent of the envelope, heelstone hiss gain 0.16 and hiss ramp 0.02 s.
- Ambient synthesis filters wind, surf, rope, waystation and pass noise at 1400, 420, 900, 700 and 1900 Hz. Wind uses base 0.82, amplitude 0.18 and gain 0.12. Surf uses base 0.55, amplitude 0.2, period 7.5 s and gain 0.16. Rope and waystation gains are 0.018 and 0.045. Gull frequency moves 900 to 1450 to 780 Hz over 0.18 s and 0.42 s, with 0.04 s attack, 0.03 s tail and gain 0.025. Creak frequency moves 120 to 230 Hz over 0.42 s, peaks at 70 percent, attacks for 0.08 s and uses gain 0.025. Wood uses 105 Hz, gain 0.025, duration 0.09 s and intervals 3 to 8 s.
- The portico chord uses 110, 164.81 and 220 Hz at gain 0.1. Music uses crossfade time-constant divisor 3, title multiplier 0.35, explore gain 0.12, combat gain 0.14, D dorian frequencies 146.83, 164.81, 174.61, 196, 220, 246.94 and 261.63 Hz, string detune 7 cents, string filter 900 Hz, string octave 0.5x, flute octave 2x, breath filter 3000 Hz, breath gain 0.008, flute base 293.66 Hz, vibrato depth 4 Hz, string ramp 0.12 s and flute ramp 0.08 s. Drums move 90 to 40 Hz over 0.16 s with noise gain 0.05 for 0.12 s.
- Cue synthesis values are: cast whistle 0.25 s, 740 to 1480 Hz, gain 0.3; cord snap 0.08 s, 2400 Hz filter, playback 1.3x, gain 0.4; recall rattle 0.28 s, 1800 Hz filter, playback 1.7x, gain 0.18; cord cut 0.18 s, 130 to 65 Hz, playback 0.65x, gain 0.45; portico bell 1.2 s, 880 and 1320 Hz ending at 876 and 1316 Hz, gain 0.42; heelstone chime 0.55 s, 988 to 986 Hz, gain 0.28; footstep duration 0.09 s, stone end 110 Hz and wood filter 900 Hz; landing 0.18 s, 120 to 55 Hz, noise 0.08 s, playback 0.7x, gain 0.4; block end frequencies 760 and 1100 Hz at gain 0.22; hurt end 65 Hz, playback 0.75x, gain 0.38; arrow 0.06 s, filter 2900 Hz, playback 1.8x, gain 0.22; flesh end 90 Hz, noise 0.07 s, playback 0.8x, gain 0.35.

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
      /scenes        Zone.tsx, Hollow.tsx, SceneManager.tsx, sceneRuntime.ts
      /player        PlayerController.tsx, CameraRig.tsx, input.ts
      /weapons       CordWeapon.tsx, cordState.ts, verletRope.ts
      /combat        combat.ts, hitboxes.ts
      /effects       effects.ts, effectRuntime.ts, EffectController.tsx, heelstonePass.ts
      /portico       Portico.tsx, crossing.ts, porticoRuntime.ts, porticoGameplay.ts
      /hollow        hollow.ts, hollowRuntime.ts, HollowEncounter.tsx, snag.ts
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

M7 explicit build budgets (all GAME (NEW), revisable):

- Main entry JavaScript is at most 1300 kB gzip. The existing 1.5 MB hard cap remains.
- The lazy audio engine chunk is at most 40 kB gzip, the lazy performance readout chunk is at most 10 kB gzip, and the lazy post-processing chunk is at most 60 kB gzip. None is a static import of the main entry.
- The Hollow chunk remains at most 5 MB. All GLB files in `public/models` total at most 1.5 MB on disk, with no single GLB over 400 kB.
- Initial download is at most 4 MB gzip for `index.html`, entry JavaScript and CSS, static imports, and zone GLBs loaded before first playable. The existing 15 MB cap remains.
- `npm run build` reads the Vite manifest, prints the measured budget table and fails when any limit is exceeded.
- M7 quality profiles apply live: Low, Medium and High use scatter density 0.5x, 1x and 1.5x; draw distance 450 m, 650 m and 850 m; device pixel ratio 1, [1, 1.5] and [1, 2]; and shadow maps 1024, 1024 and 2048.
- While active play remains below 45 fps for 8 continuous seconds, automatic quality fallback drops one tier and shows a 4 s notice. It drops at most once from each tier in a page session. A player-selected tier disables the fallback.

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
2. Strength duration of 180 s and the "no effect on return crossing" rule are game-only numbers. Keep? Answered by Ryan on 2026-11-02: keep 180 s and no effect on a return crossing for Slice 1.
3. Hero: original route runner, or a choice of peoples at character creation later?

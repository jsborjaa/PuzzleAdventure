# Puzzle Adventure — game bible

Snapshot of what the product **is and does today**, for product and engineering. Update this file when behavior, storage keys, or architecture rules change.

UI copy is translated (`en` / `es` / `de` / `fr` / `pt`). Code and this document are **English**. `en` is the catalog of record.

---

## 1. Product in one page

Puzzle Adventure is a **phone jigsaw** (portrait and landscape). Players assemble a photo into interlocking pieces, using drag, tap-to-rotate, snap, camera pan/pinch, and a small set of power-ups.

| | |
|---|---|
| **Platforms** | Android via Capacitor (Play internal testing). Web is **local Vite DEV only** — no public web store. iOS is not added yet (Mac + Xcode later). |
| **Campaign** | Sequential levels (`level_1` …) from Supabase `levels`, map pages of 10 thumbs. |
| **Events** | Calendar catalog (`event_puzzles`), apart from the map. Diario / Semanal / Mensual for the current UTC day / ISO week / month. Empty slot copy when that period has no puzzle. Always unlocked when present. |
| **Session** | One in-progress campaign save. Events save per occurrence id. Completed puzzles open assembled with **Desarmar y jugar**. |
| **Times** | Personal best / last / clear count per level id in localStorage (never evicted with photos). Global ranking in Supabase `scores`. Win card champion cup → top 10 + own rank. |
| **Economy** | Commons (`hint`, `lucky`, `reveal_temp`) farm from campaign first-clear (scripted packs on levels 1–4; random commons by rank from 5) and Daily. Rares (`area`, `sarea`, `solver`, `reveal_perm`) from Weekly/Monthly, crafting, and IAP. Win-card ads can double a first-clear pack (level 5+) or grant 1 common on replay — **not** the Store 5/day cap. IAP: Vite DEV simulates; Android production uses Google Play Billing (`pack_handy`, `pack_rare`). Store rewarded ads: DEV simulates; Android uses AdMob (Google test ids until a real account). Production web grants neither. `SIMULATE_IAP` forces IAP simulate on every platform. |
| **Identity** | Anonymous Supabase session + optional nickname in Settings. No email login. Rankings need **Anonymous** enabled (Authentication → Providers). |
| **Not in the game** | Pockets, CameraTool, haptics. |
| **Languages** | English, Español, Deutsch, Français, Português. Menu picker. First launch follows the device, else English. |

---

## 2. How to run

```bash
npm install
npm run dev          # http://localhost:5173/ — local only, not a public store
npm test             # vitest, domain only
npm run build
npm run ingest -- content/campaign
npm run ingest:events -- content/events/2026-09
```

Android (needs Android Studio / SDK):

```bash
npm run android      # build web → cap sync → run
# or: npm run cap:sync && npx cap open android
npm run android:bundle   # signed AAB → android/app/build/outputs/bundle/release/app-release.aab
```

iOS (later, on a Mac):

```bash
npx cap add ios
npm run build && npx cap sync
npx cap open ios
```

Copy `.env.example` to `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Optional: `VITE_ADMOB_APP_ID` / `VITE_ADMOB_REWARDED_UNIT_ID` (defaults are Google sample ids). Enable **Anonymous** sign-in (Authentication → Providers) — required for global rankings — and run `supabase/migrations/20260903000000_init.sql`. Photos live in the `level-images` bucket; there is no bundled seed in `public/`.

---

## 3. Technology

| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript (strict) | `tsconfig.json` — ES2020, bundler resolution, `noEmit` |
| Bundler | Vite 5 | `base: './'` so Capacitor file URLs work |
| Game view | Phaser 3.80 | Canvas in `#game-container`, `Scale.RESIZE`. `input.touch.capture` is **false** so chrome/tray receive fingers. In a level, Phaser only fills the center hole of the play-shell. |
| HUD / menu | Vanilla DOM | Hub in `#ui-layer`. In-level chrome/status/tray are siblings of the canvas. **Not React.** |
| Tests | Vitest (node) | `src/**/*.test.ts` — Phaser-free domain only |
| Native shell | Capacitor 6 | App id `com.puzzleadventure.app` |
| Android | Capacitor Android project | `fullUser` orientation, status bar `#6ec8ff` |
| Persistence | `localStorage` | Progress, session, power-ups, times, locale, claims, last played, nickname |
| Cloud | Supabase | Catalog, event art, anonymous auth, global scores. Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| IAP | Google Play Billing | `capacitor-plugin-cdv-purchase`. Product ids `pack_handy`, `pack_rare`. Prices from Console. |
| Ads | AdMob rewarded | `@capacitor-community/admob`. Google test app/unit ids until a real AdMob account. |
| i18n | One typed catalog | `src/i18n/messages.ts` — `t('hud.menu')`. No i18next. |
| Piece textures | Canvas atlases + IndexedDB | DB `puzzle-adventure-atlas-v2`; skipped in `import.meta.env.DEV` |
| Image cache | IndexedDB `puzzle-adventure-images-v1` | Current map page thumbs, current event thumbs, last-played (even if off-page). Eviction does **not** touch scores |
| Audio | Web Audio oscillators | Pop / snap / click / win. No sound files. |

**HTML shell** (`index.html`): `#app` → `#game-container` (Phaser) + `#ui-layer` (hub, overlays). In a level, `PlayShell` adds chrome, status, and piece tray around the canvas (`#app.play-active` grid). Viewport is `viewport-fit=cover`, no user scale.

**Phaser boot:** `src/main.ts` → `boot()` → `Phaser.Game(GameConfig)` with **only** `BootScene`. Menu and Game scenes are lazy-imported; campaign photos load on demand.

---

## 4. Architecture

### 4.1 Layers (keep these boundaries)

```
src/app/        Phaser game config + boot (resize to viewport, or to `#game-container` in a level)
src/domain/     Pure rules. No Phaser, no DOM.
src/data/       Levels catalog + ProgressStore (localStorage)
src/i18n/       messages.ts (all languages per key) + t()
src/engine/     Phaser runtime: board, camera, tools, atlas, scenes, audio
src/ui/         HTML menu + play-shell + HUD + tray + CSS
src/main.ts     Entry (initI18n before Phaser)
```

**Hard rules for future work:**

1. **Piece ids are `levelId:col:row`**, never array indexes. Resume, hint, and atlas frames all key off this (`makePieceId` / `parsePieceId`).
2. **One solve path:** `PuzzleSession.placePiece`. Snap, hint confirm, and any future “auto-place” must go through it.
3. **Domain stays Phaser-free.** If a rule can be unit-tested without a canvas, it belongs in `src/domain/`.
4. **Pockets and CameraTool stay deleted.** Camera pan/pinch is `CameraController`, not a HUD tool.
5. **Do not save a fully solved session.** `PuzzleSession.save()` no-ops in `replay`, after win, or when `isWon` is already true.

### 4.2 Folder map

| Path | Responsibility |
|---|---|
| `src/domain/PuzzleSession.ts` | Session state machine: pieces, timer, inventory, reveal, save, win |
| `src/domain/types.ts` | `PieceState` (`inTray`), `SavedSession` v3\|v4, `SessionEvent` |
| `src/domain/product.ts` | Tunable constants, power-up keys, defaults |
| `src/domain/boardShape.ts` | Square vs landscape vs portrait from image aspect |
| `src/domain/powerups.ts` | Catalog (tier, family, craft), grant packs, store SKUs, period keys |
| `src/domain/jigsaw.ts` | Seeded tab/slot layout from image size + piece count |
| `src/domain/snapRules.ts` | Angle 0 + distance `< 30px` |
| `src/domain/inventory.ts` | Consume / craft / applyPack |
| `src/domain/grid.ts` | Grid math, `worldToCell`, `clampSelection`, `deviceMemoryGb` |
| `src/data/ProgressStore.ts` | Unlock index, sessions, power-ups, times, locale, claims, last played, nickname |
| `src/domain/quality.ts` | Cap huge puzzles on low-RAM devices |
| `src/domain/win.ts` | `isWon` / `countSolved` |
| `src/domain/timer.ts` | Elapsed ms + `m:ss` / `h:mm:ss` |
| `src/data/Levels.ts` | `LevelData` type + localized titles |
| `src/data/LevelCatalog.ts` | Campaign pages of 10 + current calendar events (Supabase) |
| `src/data/imageCache.ts` | Thumb/full IndexedDB + eviction |
| `src/data/billing/` | IAP port: simulate (Vite DEV) vs Play Billing (Android production) vs unavailable (production web) |
| `src/data/ads/` | Rewarded-ad port: simulate (Vite DEV) vs AdMob (Android production) vs unavailable (production web) |
| `src/domain/ads.ts` | AdMob test ids + optional `VITE_ADMOB_*` overrides |
| `src/data/cloud/` | Supabase client, anonymous auth, leaderboard RPCs |
| `src/domain/campaignDifficulty.ts` | Piece-count curve (shared with ingest) |
| `src/engine/GameRuntime.ts` | Wires session + board + play-shell + HUD + tray + tools; chooses play mode |
| `src/engine/board/` | Sprites, layers, guide image |
| `src/engine/pipeline/` | Masked piece atlas, cache, jigsaw path |
| `src/engine/input/` | Drag/rotate/snap, pan/pinch, tray hit-test |
| `src/engine/tools/` | Área 3×3, sÁrea 4×4, Pista 1×1, Lucky, Solver 3×3, 20s / Infinito |
| `src/engine/scenes/` | Boot → Menu → Game |
| `src/i18n/messages.ts` | All UI copy: each key has `en` / `es` / `de` / `fr` / `pt` |
| `src/ui/PlayShell.ts` | In-level grid: chrome, status, canvas hole, tray |
| `src/ui/GameHud.ts` | Chrome (back, commons, rares, peek) + status + win card |
| `src/ui/PieceTray.ts` | Unsolved-piece strip; tap-rotate; drag onto the board |
| `src/ui/MenuView.ts` | Hub: map, events, store, workshop, settings, start sheet |
| `src/ui/style.css` | Hub tokens, 3D buttons, dock, play-shell, HUD |

### 4.3 Data flow (play)

```
MenuView  --start sheet Play-->  GameScene  -->  GameRuntime.start()
                                      ├─ quality gate → jigsaw layout → PuzzleSession
                                      ├─ PlayShell (chrome / status / canvas hole / tray)
                                      ├─ PuzzleBoard (atlas + sprites)
                                      ├─ CameraController (fit board)
                                      ├─ ToolManager (area / sarea / hint / lucky / solver / reveal)
                                      ├─ GameHud  ← session events
                                      └─ PieceTray ← session events
Player input → PieceInteraction / tray drag / tools → PuzzleSession commands
PuzzleSession emits events → HUD + tray + board visuals
Win → recordClear + first-clear/period grant + unlock + clear session → overlay
Leave / hide tab → session.save() (skipped if replay or already won)
```

---

## 5. Content

### 5.1 Campaign (`levels`)

Live games fetch `get_level_window` from Supabase, one **page of 10**. Map cards load that page’s thumbs on screen (with a shimmer until each photo arrives). Changing page **evicts** the previous page from IndexedDB, except **current events** and **last-played**. One full JPEG on Play. Photo eviction never deletes times.

Piece counts follow `getDifficultyForLevel` (ingest and live rows share the curve):

| Level | Id | Pieces |
|---|---|---|
| 1–2 | `level_1`, `level_2` | 16 |
| 3–4 | | 36 |
| 5 | `level_5` | 64 |
| 6 | `level_6` | 36 |
| 7 | `level_7` | 16 |
| 8–9 | | 36 |
| 10 | `level_10` | 64 |
| 11+ | | shuffled bag of 36/64/128 (same seed as before; S was 100, now 128) |

Phaser texture keys: `img_level_N` / `img_<event id>`. Titles include a localized difficulty tag.

Menu card badge (`diffLabel`): 16→C, 36→B, 64→A, 128→S, 200→SS, 500→SSS, 1000→SSSS. If a saved session’s piece count does not match the current layout (e.g. an in-progress S that still has 100 pieces after ingest writes 128), that session is discarded and the level starts fresh.

**Adding a campaign level:** drop a numbered JPEG in `content/campaign/` (e.g. `0015.jpg`) and run `npm run ingest`. Piece count comes from `getDifficultyForLevel`.

### 5.2 Events (`event_puzzles`)

Apart from the map. Ids are occurrence-scoped (`event_daily_2026-09-03`) so each day has its own récord and leaderboard. Upload a whole month with `npm run ingest:events -- content/events/2026-09` (`daily/01.jpg` …, `weekly/W36.jpg`, `monthly.jpg`). Do **not** delete last month’s rows on update. Optional `--prune-art-before 2026-07` deletes old **art** only.

A missing period is an **empty slot** (no seed photo). Without cloud keys the three slots stay empty.

Always unlocked. Not part of the campaign index. Live occurrence ids include the period key. Quality gate may reduce 200+ piece counts to 200 when `navigator.deviceMemory < 4`.

### 5.3 Unlocking

- Stored as `highestUnlockedIndex` (0 = only level 1).
- Completing campaign level N (0-based index) sets the index to at least N+1.
- `isLevelUnlocked('level_k')` ⇔ `k - 1 <= highestUnlockedIndex`.
- `isLevelCompleted('level_k')` ⇔ `k - 1 < highestUnlockedIndex`.
- Events: unlocked always; “completed” for replay is `getBestMs(id) !== null`.

**Reset** (menu): campaign unlocks + campaign in-progress session. Does **not** wipe times or power-ups.  
**Reset eventos** (menu): event in-progress saves + event times (`event_*`) + **event period claims** (so the next win can grant again). Ads daily cap is not cleared.

---

## 6. Play modes

Chosen in `GameRuntime.start()`:

| Mode | When | Pieces | Timer | Save | Power-ups |
|---|---|---|---|---|---|
| **fresh** | New play, or **Desarmar y jugar** (`forceReplay`) | All in the tray, unsolved, random 0/90/180/270° | Starts at 0 | Yes (in progress) | Consumed |
| **resume** | Saved session for **this** level with at least one unsolved piece | Restored by piece id (`inTray` / board `x,y`) | Continues `elapsedMs` | Yes | Consumed |
| **replay** | Level already cleared and **no** in-progress save | All solved, assembled; tray empty | Does not run | Never | Disabled |

Campaign uses **one** slot (`puzzle_adventure_session_v3`). The payload `version` is **4** (`inTray`); v3 saves still load (unsolved pieces move into the tray). Starting a **new unsolved** campaign level overwrites it. Opening or disarming a **completed** other campaign level does not (replay never saves; `skipCampaignSave` blocks a Desarmar run from replacing the in-progress slot, so infinite ghost on the unsolved board survives). Events use `puzzle_adventure_special_sessions_v3` keyed by level id.

`forceReplay: true` (Desarmar) always starts **fresh** (tray shuffle), even if the level was completed.

A leftover fully-solved save is **not** treated as resume (`inProgress` requires an unsolved piece).

---

## 7. Player flows

### 7.1 Boot

1. DOM splash (logo + bar) in `#ui-layer` while `BootScene` loads catalog **metadata** (not every campaign photo).
2. Lazy-loads `MenuScene` and `GameScene`, signs in anonymously if cloud is configured, loads the current map page + current events.
3. Starts the hub (menu). Map thumbs load per card; paging evicts the previous page.

### 7.2 Hub (menu)

Portrait home with Candy Crush-like chrome around the photo grid (landscape allowed; hub scrolls):

- **Top:** stacked logo · Settings gear.
- **Map tab:** photo cards for the **current page** (10 levels, last page may be shorter). Position line `from–to / total`. Chevrons move one page and show a loading mask, then each card shimmers until its thumb arrives. Locked cards show the thumb **blurred** under a glossy `?`. Current unlock pulses. Best time as a gold pill.
- Tap an unlocked card → **start sheet** (thumbnail, piece count, photo shape chip, best time, **Play**).
- **Events tab:** three slots (Daily / Weekly / Monthly). Live calendar row if that period exists; otherwise an empty card (`Hoy no hay evento diario`, and the weekly/monthly equivalents).
- **Store / Workshop tabs:** full pages (not overlays). Craft and SKUs unchanged.
- **Bottom dock:** Map · Events · Store · Workshop.
- **Settings:** language. **Reset** / **Reset events** only in `import.meta.env.DEV`.

### 7.3 In-level play-shell

Not a full-screen Phaser canvas with HUD overlays. `#app.play-active` is a grid; orientation class is based on **#app** aspect (`is-portrait` / `is-landscape`), not the window, so the dev device preview still works.

| Region | Portrait | Landscape |
|---|---|---|
| Chrome | Top row: Back, Commons, Rares, Peek (captions under icons). Replay when assembled/won. Android hardware back closes a power-up popover or returns to the map. | Left rail (~68px), same controls in a column. Icons stay upright (`flex-direction`, no HUD `transform`). |
| Status | Under chrome: progress + timer / récord / 20s countdown | Overlay at the top of the board hole |
| Phaser `#game-container` | Center | Center |
| Piece tray | Bottom **20%** height, scroll X | Right **20%** width, scroll Y |

**Commons / Rares** open a popover over the status bar (`POWERUP_DEFS` by `tier`). Hold a tool and confirm by releasing on the photo. While **Peek** is held, pieces cannot be dragged or rotated (canvas or tray); the ghost still shows. Rares with a recipe show a **Craft** control listing the ingredient cost (stock 0 is fine) so you can craft in-level. After a hold-tool is used, the popover closes.

`#ui-layer` stays full-screen for the win card and toasts (`pointer-events: none` except overlays). Chrome and tray are **not** inside `#ui-layer`.

The photo is **never** rotated 90° when the phone turns. Landscape only moves the tray to the right so a wide board can fill the hole.

### 7.4 Assemble

1. Unsolved pieces start in the tray as bare chips (no card chrome). **Tap** a chip = rotate 90°. **Swipe along the strip** scrolls it — no scrollbar. **Pull toward the board** (or a short ~80ms hold) picks the piece up: it stays under the finger (tray size on the strip, board size on the canvas). The source chip leaves the strip so there is no empty hole; a dashed insert slot appears only when reordering. Dropping back onto the tray **inserts between the chips under the finger** (so it stays in view); the strip scrolls that chip into view.
2. On the canvas: drag a piece (pop SFX, slight scale-up). Short drag (`< 10px`) on release = **rotate 90°**. A second rotate within 150ms is ignored so a finger tap is never 180°. **Peek hold** blocks both drag and rotate.
3. Release near the correct slot, **upright** (`angle === 0`), within **30px** → snap (two-note chime), `placePiece`, ink/coral/gold outline along the jigsaw shape.
4. Solved sprites move to the solved layer and lose interaction. Hint uses the same outline glow when the piece locks.

`piece.angle` is the only rotation. Turning the phone does **not** add a CSS/layout rotate on chips (that would desync snap). Tray chips and board sprites both paint that angle.

Pan: drag empty space on the canvas. Pinch: two fingers, zoom 0.15–3. Camera is disabled while a HUD tool is held or a tray chip is dragged. In-level sky matches the hub (`#6ec8ff`). Opening view fits the **board** (not a scatter world) in the canvas hole.

### 7.5 Win

- Timer pauses. `recordClear(levelId, elapsedMs)` writes best/last/clears.
- Campaign: `completeLevel`. If the unlock index **increases**, grant first-clear pack.
- Events: grant the period pack **once** (UTC day / ISO week / `YYYY-MM`). Replay and already-claimed periods: no pack.
- In-progress session for that puzzle is **cleared**.
- Overlay: cream win card (pop-in), time, récord / nuevo récord, **champion cup** (global rank; tap for top 10 + own row if not top 10), **reward chips if granted**, optional **win ad** (×2 first-clear from campaign level 5 / events, or 1 random common on replay; hidden on production web; DEV uses SimulateAds), **Scatter and play**, **Map**. First-clear on campaign levels **1–4** has no ×2 button.
- HUD also gains **Desarmar y jugar** so a second attempt does not require leaving.

Leaving after a win does **not** write a solved session back (that was the “button disappeared until I visited another level” bug).

### 7.6 Desarmar y jugar

Clears the session **only if it belongs to this level**, then `scene.restart({ levelId, forceReplay: true })` → tray shuffle. Disarming a completed **other** campaign board does not wipe the in-progress save (and that run does not write a new campaign session). After that run is won, the disarm control is shown again.

---

## 8. Systems

### 8.1 Pieces and layout

- Grid from image aspect × requested count (`computeGrid`).
- Seeded tabs/slots (`buildJigsawLayout`); seed = hash of `levelId`, grid, image size.
- Unsolved pieces go in the **tray** (`inTray`), random 0/90/180/270°. v3 saves migrate unsolved pieces into the tray (old scatter positions are dropped). Session saves as **v4**.
- World bounds are the photo plus `BOARD_WORLD_PAD` (pan/peek only — not a scatter band). Initial camera fits the **board** in the canvas hole (`CAMERA_FIT_VIEW_PAD`).
- `boardShape(w, h)`: `|w-h|/max < 0.08` → square, else landscape or portrait. Used for camera fit and a start-sheet chip. The app does not crop photos.

### 8.2 Atlas pipeline

1. Fingerprint a 32×32 downscale of the photo (so replacing `Stage_N.jpg` invalidates cache).
2. Cache key: `levelId:cols x rows:seed:imageKey:fingerprint`.
3. Draw each piece with a clipped jigsaw path onto atlas canvases (max 4096).
4. Memory map always; **IndexedDB only in production builds**.

If pieces look like an **old photo** after you replaced art: hard-refresh in dev, or bump/clear `puzzle-adventure-atlas-v2` in production.

### 8.3 Power-ups (catalog + farm)

Inventory is a flat `Record<PowerupKey, number>` in `puzzle_adventure_powerups_v1`, shared across all levels. **Add a new power-up as one row** in [`src/domain/powerups.ts`](../src/domain/powerups.ts) (`POWERUP_DEFS`); do not special-case craft or grants.

| Id | Tier | Family | Default | Craft result | Effect |
|---|---|---|---|---|---|
| `hint` | common | place | 0 | ingredient | Hold, aim 1 cell. Animates that piece (or a random unsolved neighbor) into place, then `placePiece` + consume. |
| `lucky` | common | place | 0 | ingredient | Hold, drop on the photo. Picks a **random unsolved** piece and uses the Hint fly-in. |
| `reveal_temp` | common | reveal | 0 | ingredient / 10 → Infinito | Hold, drop on the photo: ghost 20s. Ignored if perm is on. |
| `area` | rare | gather | 0 | 6 Hint + 3 Lucky + 1×20s | Hold: 3×3 gather. Yellow rect stays until gather tweens finish. |
| `sarea` | rare | gather | 0 | 10 Hint + 6 Lucky + 2×20s | Hold: 4×4 gather. Same linger overlay. |
| `solver` | rare | place | 0 | 9 Hint + 5 Lucky | Hold: 3×3. Places every unsolved piece in that zone (fly-in + glow). Empty zone does not consume. |
| `reveal_perm` | rare | reveal | 0 | 10×20s | Hold, drop on the photo: ghost (alpha 0.3) until that level is solved. Consumes once; not a toggle. Survives leaving the level (saved on the campaign session). |

Commons share the same store value. Rares are the farm / craft output. Area is **rare** (no longer a common). A new player starts at **0** on every key; the first charges come from winning levels (or Store / ads).

Hold-tools track **window** `pointermove`. Confirm uses Phaser `transformPointer(pageX, pageY)`. Reveal tools consume only if the pointer is released on the photo. Peek-hold blocks piece drag/rotate so 20s / Infinito cannot be played with the photo in view.

**Craft:** `CRAFT_RECIPES` in [`src/domain/powerups.ts`](../src/domain/powerups.ts). Hub **Workshop** has one button per recipe. The in-level Rares popover can craft the same recipes when ingredients suffice.

**Sources (campaign first-clear never on replay):**

| Source | When | Pack |
|---|---|---|
| Campaign first clear 1 | `completeLevel` bumps unlock | `{ hint: 1 }` |
| Campaign first clear 2 | same | `{ lucky: 1 }` |
| Campaign first clear 3 | same | `{ reveal_temp: 1 }` |
| Campaign first clear 4 | same | `{ hint: 6, lucky: 3, reveal_temp: 1 }` (one Área recipe) |
| Campaign first clear 5+ | same | C/B: 1 random common; A/S: 2 random commons |
| Daily | first win this UTC day | `{ hint: 2, lucky: 2, reveal_temp: 2 }` |
| Weekly | first win this ISO week | `{ hint: 2, lucky: 4, sarea: 1 }` |
| Monthly | first win this `YYYY-MM` | `{ hint: 3, reveal_temp: 5, sarea: 2, reveal_perm: 1 }` |
| Store rewarded ad | After the AdMob reward (or DEV simulate). Cap **5 / UTC day** | 1 random common |
| Win-card ad | Independent of the Store cap. First clear 5+ / events: ×2 the granted pack. Replay any level: 1 random common. Levels 1–4 first clear: no button. | see above |
| `pack_handy` | Play product id `pack_handy` (consumable). Vite DEV: local simulate. | 10 hint + 10 lucky + 10 temp |
| `pack_rare` | Play product id `pack_rare` (consumable). Vite DEV: local simulate. | 2 Área + 3 sÁrea + 2 Infinito + 1 Solver |

Period keys live in `puzzle_adventure_claims_v1`. Replay and a second win in the same period show the existing win card with **no** reward list.

**Store** does not grant packs itself. IAP calls `ensureBilling()` → `purchase(skuId)` and only then `grantPack`. Store ads call `ensureAds()` → `watchRewarded()` and only then `tryClaimAdCommon`. Win-card ads call `ensureAds()` then `grantWinPack` (no Store cap). Cancel / skip / error: no grant. See **8.9** and **8.10**.

Replay mode: tools and reveals that consume charges are no-ops. **Peek** (eye hold) still works, but pieces cannot be dragged or rotated while it is held. Completing a level that was already cleared (Desarmar y jugar) grants no free pack; the win card can offer a farm ad for 1 random common.

### 8.4 Timer and times

- Tick from Phaser `update` delta. HUD refreshes ~every 200ms.
- On each win: `{ bestMs, lastMs, clears }` in `puzzle_adventure_times_v1` (kept forever).
- HUD shows **Récord**; overlay shows this run vs best plus champion cup.
- Menu cards show best if present.
- Global table: each win (and the start-sheet cup on a cleared level) calls `submit_score` with the **device best** after anonymous sign-in. If Anonymous is disabled, the sheet says the time could not be saved instead of pretending the board is empty. The RPC only overwrites the cloud row if this time is faster. `get_leaderboard` is top 10 + own rank.

### 8.5 Quality gate

If requested pieces **> 200** and `navigator.deviceMemory < 4`, count becomes 200 and HUD toasts that RAM limited the puzzle.

### 8.6 Audio

`AudioService` singleton: generated blips. `playWin` on `won`. Resume AudioContext on first gesture.

### 8.7 Native

- Capacitor app name **Puzzle Adventure**, id `com.puzzleadventure.app`, `webDir: dist`.
- Android `MainActivity` = `BridgeActivity`, `android:screenOrientation="fullUser"` (rotates if the system allows). In-level Phaser camera `setSize`s on scale resize so the board uses the full landscape viewport.
- Status bar dark icons / `#6ec8ff` from `bootstrap.ts` on native only.
- Hardware back (`@capacitor/app`): in a level, close the commons/rares popover or return to the map (same as the Back chrome button). On the hub, exit the app.
- Haptics: **not wired**.

### 8.8 Languages

Shipped: `en` (canonical keys + fallback), `es`, `de`, `fr`, `pt`.

Resolution: saved `puzzle_adventure_locale_v1` → first matching `navigator.languages` (`pt-BR` → `pt`) → `en`.

Picker: Settings on the hub (gear). Changing language rebuilds the hub. In-level HUD uses the locale at scene start (return to map to switch).

All player-facing copy lives in [`src/i18n/messages.ts`](../src/i18n/messages.ts): one object per string, all five languages together. `t('group.key')` reads the active locale. Do not hardcode HUD/menu strings.

**Add a string:** one `loc({ en, es, de, fr, pt })` under the right group. Missing a language fails `tsc`.

**Remove a string:** delete that object.

**Add a language:** extend `LocaleId` and every `loc({...})`; `tsc` lists gaps. Also add the picker row in `SUPPORTED_LOCALES`.

### 8.9 Play Billing (Android)

Play Console app id **`com.puzzleadventure.app`**. In-app products are **consumables** with the same ids as `STORE_SKUS`:

| Play product id | Pack |
|---|---|
| `pack_handy` | 10 hint + 10 lucky + 10 temp |
| `pack_rare` | 2 Área + 3 sÁrea + 2 Infinito + 1 Solver |

**Prices live only in Play Console** (Handy **1 EUR**, Rare **3 EUR**). The app does not hardcode them. The Store button shows Google’s localized `priceLabel`.

**Code path** (`src/data/billing/`):

- `ensureBilling()` → `SimulateBilling` in Vite DEV, or when `SIMULATE_IAP` is true.
- Android **production** → `PlayBilling` (`capacitor-plugin-cdv-purchase`): query price, `launchBillingFlow`, **acknowledge / finish**, then the Store calls `grantPack`.
- Production **web** → unavailable (no grant). Play Billing does not run in a browser; there is no Stripe/PayPal.

Cancel / error: no pack. Purchases approved while the Store was not waiting are delivered via `drainQueued()`.

**How to test (no in-app login):**

1. Bump `versionCode` in `android/app/build.gradle` above the last Play upload.
2. `npm run android:bundle` → `android/app/build/outputs/bundle/release/app-release.aab`.
3. Upload the AAB to **internal testing**. Install **from the Play Store** on that track (sideload does not run test purchases).
4. The device’s **Play Store Google account** must be a **license tester** (and on the internal testers list). Play shows a test-purchase sheet and does **not** charge.
5. Signing: `android/keystore.properties` + the `.jks` (both gitignored).

### 8.10 Rewarded ads

Store SKU `ad_common`: 1 random common, cap **5 / UTC day** (`ProgressStore.tryClaimAdCommon`). Grant **only** after `watchRewarded()` returns `rewarded`.

- Vite DEV → `SimulateAds` (confirm, no video).
- Android production → AdMob rewarded (`@capacitor-community/admob`). UMP consent form if Google says it is required.
- Production web → button disabled.

Until a real AdMob account exists, the build uses Google **sample** ids (`src/domain/ads.ts` and `android/.../strings.xml` `admob_app_id`):

- App id `ca-app-pub-3940256099942544~3347511713`
- Rewarded unit `ca-app-pub-3940256099942544/5224354917`

Optional overrides: `VITE_ADMOB_APP_ID`, `VITE_ADMOB_REWARDED_UNIT_ID`. A production App id must also replace `@string/admob_app_id` in the Android manifest resources.

---

## 9. Persistence reference

| Key | Contents |
|---|---|
| `puzzle_adventure_progress_v2` | Campaign `highestUnlockedIndex` (string int). Migrates legacy `puzzle_adventure_progress` array. |
| `puzzle_adventure_session_v3` | Single campaign `SavedSession` (JSON `version` 4; v3 still loads). |
| `puzzle_adventure_special_sessions_v3` | Map of event id → `SavedSession` (v3 or v4). |
| `puzzle_adventure_powerups_v1` | Per-key counts. Missing keys filled from `DEFAULT_POWERUPS` (all 0). |
| `puzzle_adventure_times_v1` | Map of level id → `{ bestMs, lastMs, clears }`. |
| `puzzle_adventure_locale_v1` | Saved locale id (`en` / `es` / `de` / `fr` / `pt`). Absent = follow device, else `en`. |
| `puzzle_adventure_claims_v1` | `{ eventPeriods, adsDate, adsCount }`. Event **type** → period key; ads reset each UTC day. |
| `puzzle_adventure_last_played_v1` | Last started level id (kept in the image cache even if off the current map page). |
| `puzzle_adventure_nickname_v1` | Optional leaderboard name. |
| `puzzle_adventure_catalog_v3` | Last map page metadata (ids/urls only, not blobs). |
| IndexedDB `puzzle-adventure-atlas-v2` | Packed piece PNGs + frames. |
| IndexedDB `puzzle-adventure-images-v1` | Thumbs/full for the current map page + current events + last-played. |

`SavedSession` version **3**: `{ version, levelId, pieces: [{ id, x, y, angle, isSolved }], revealPermanent, elapsedMs, lastUpdated }`.

On load, keys starting with `pockets:` are deleted (legacy).

`ProgressStore` is a singleton via `getInstance()`. Tests pass `MemoryStorage`.

---

## 10. Tunables (`src/domain/product.ts`)

| Constant | Value | Meaning |
|---|---|---|
| `SNAP_DISTANCE_PX` | 30 | Snap radius |
| `REVEAL_TEMP_MS` | 20_000 | Temp reveal duration |
| `REVEAL_*_ALPHA` | 0.3 / 0.4 | Guide image opacity |
| `BOARD_WORLD_PAD` | 180 | World padding around the photo for pan/peek |
| `CAMERA_FIT_VIEW_PAD` | 48 | Padding around the **board** for the opening zoom |
| `CAMERA_ZOOM_MIN/MAX` | 0.15 / 3 | Pinch limits |
| `CAMERA_FIT_ZOOM_*` | 0.15 / 3 | Initial fit clamp (board fills the hole) |
| `QUALITY_SOFT_CAP` | 200 | Low-RAM piece cap |
| `QUALITY_LOW_RAM_GB` | 4 | Gate threshold |
| `ATLAS_MAX_SIZE` | 4096 | Atlas canvas max |
| `DEFAULT_POWERUPS` | all 0 | New player inventory (nothing until a win, IAP, or ad) |
| `SIMULATE_IAP` | `false` | When true, force local IAP even on Android release |

AdMob sample ids live in `src/domain/ads.ts` (not `product.ts`). Craft recipes live in `CRAFT_RECIPES` in `src/domain/powerups.ts`. Grant packs and `STORE_SKUS` are in the same file.

Piece interaction tap threshold: **10px** (`PieceInteraction.ts`). Rotate debounce **150ms** so a finger tap is one 90° turn. Área / sÁrea / Solver grid sizes: **3**, **4**, and **3** (`GameRuntime`). S campaign boards use **128** pieces (ingest writes `piece_count`).

---

## 11. Tests

`npm test` — Vitest, node environment.

| File | Covers |
|---|---|
| `PuzzleSession.test.ts` | Ids, tray on fresh, snap→win, hint consume, resume by id, v3→tray migrate, **no save after win**, first-clear / period grants |
| `boardShape.test.ts` | Square vs landscape vs portrait |
| `grid.test.ts` | Grid, world→cell, clamp selection |
| `pieceId.test.ts` | `level:col:row` parse |
| `snapRules.test.ts` | Distance / angle |
| `inventory.test.ts` | Consume / multi-ingredient craft / applyPack |
| `powerups.test.ts` | Period keys, first-clear packs, craft recipes, IAP packs |
| `ProgressStore.test.ts` | Claims, ad cap, craft |
| `win.test.ts` | All solved |
| `i18n.test.ts` | Interpolation, `pt-BR`→`pt`, saved locale, English fallback |
| `catalogWindow.test.ts` | Map pages of 10 / last-page remainder |
| `campaignDifficulty.test.ts` | Piece-count curve |
| `billing.test.ts` | IAP sku ids + simulate port |
| `leaderboard.test.ts` | Parse `get_leaderboard` JSON (numbers or numeric strings) |
| `ads.test.ts` | AdMob test ids + simulate port |

Engine, HUD, and Capacitor are **not** unit-tested. After play-shell / tray changes, verify in the browser at `http://localhost:5173/` (dev preview + Rotate): pull a piece from the tray (no leftover hole), rotate in the tray and on the board, drop, return, snap, Peek, tools, Back, and portrait↔landscape. Do **not** build an AAB until that local pass is good.

---

## 12. Invariants (do not break)

1. Piece id = `` `${levelId}:${col}:${row}` ``.
2. Only `placePiece` marks solved + may emit `won`.
3. Campaign has **one** in-progress save; events have one per event id.
4. Never persist an all-solved board; replay is derived from unlocks / best times.
5. Domain must stay importable from Vitest without Phaser.
6. HUD tools that aim on the board must track **page** coordinates (window), not canvas-only pointermove.
7. Atlas cache must include a **pixel fingerprint**, not only level id + size.
8. `#ui-layer` is `pointer-events: none`; interactive children opt in. Do not set `#ui-layer > * { pointer-events: auto }` (it makes full-screen overlays steal the board). Play chrome/tray live outside `#ui-layer`.
9. Player-facing copy lives in `src/i18n/messages.ts`. Add or delete one object per string (all languages in that object).
10. Free first-clear / event packs happen **once** (campaign unlock bump, or event period key). Do not grant that pack on replay. Win-card ads are a separate extra grant.

---

## 13. Intentional gaps / next iterations

Use this as the backlog seed, not as committed scope.

| Item | Status now | Suggested direction |
|---|---|---|
| **Global times table** | Win-card cup + top 10 | — |
| **Play Billing** | Internal testing: `pack_handy` / `pack_rare`, license testers, prices in Console | Production listing / paid launch |
| **Rewarded ads** | AdMob on Android with Google **test** ids | Real AdMob app + rewarded unit; swap ids in `strings.xml` + env |
| **Event rotation** | Calendar `event_puzzles`; monthly ingest | Fill a full month of art |
| **iOS** | Not added | `npx cap add ios` on a Mac |
| **Play Store listing** | App + signed AAB on internal testing | Store listing, privacy policy, production track |
| **Public web** | None (local `npm run dev` only) | Stay Android-only until a web payment exists |
| **Haptics** | Unused | Capacitor Haptics on snap/win |
| **Sound assets** | Synth only | Optional files; keep `AudioService` as the single API |
| **Accounts / cloud** | Anonymous + nickname | Optional real login later |
| **Dev buttons in production** | Reset / Reset events in Settings, DEV only | — |
| **Reset vs times** | Reset progress does not clear campaign times | Product decision: wipe or keep récords |
| **Campaign session slot** | One in-progress campaign save | Replaying **another** campaign level (`Desarmar y jugar`) must not wipe that save (infinite ghost lives on it) |

---

## 14. Common change recipes

**New campaign image for an existing slot:** re-ingest the numbered file in `content/campaign/`.

**New event month:** `content/events/YYYY-MM/` then `npm run ingest:events`.

**New power-up:** add `PowerupKey` + `DEFAULT_POWERUPS`, one `POWERUP_DEFS` row, optional `CRAFT_RECIPES` entry, HUD icon + i18n, session command + tool. Commons/Rares popovers iterate the catalog.

**Change snap feel:** `SNAP_DISTANCE_PX` only.

**Change Área size:** `GameRuntime` `new AreaTool(..., 3 | 4, ...)`. `useArea` treats `size >= 4` as sÁrea charges.

**New UI string:** add one `loc({ en, es, de, fr, pt })` in [`src/i18n/messages.ts`](src/i18n/messages.ts). `tsc` fails if a language is missing. Use `t('group.key', { n })` in HUD/menu — never hardcode player-facing copy.

**Remove a UI string:** delete that object in `messages.ts`.

**Add a language:** add the id to `LocaleId` and `SUPPORTED_LOCALES`, then fill it in every `loc({...})` (`tsc` lists the rest).

**Do not** reintroduce pockets, per-piece canvases (use the atlas), or a second win/snap implementation in the engine.

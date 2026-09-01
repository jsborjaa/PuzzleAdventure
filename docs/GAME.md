# Puzzle Adventure — game bible

Snapshot of what the product **is and does today**, for product and engineering. Update this file when behavior, storage keys, or architecture rules change.

UI copy is translated (`en` / `es` / `de` / `fr` / `pt`). Code and this document are **English**. `en` is the catalog of record.

---

## 1. Product in one page

Puzzle Adventure is a **portrait-first jigsaw** for phones. Players assemble a photo into interlocking pieces, using drag, tap-to-rotate, snap, camera pan/pinch, and a small set of power-ups.

| | |
|---|---|
| **Platforms** | Web (dev + play), Android via Capacitor. iOS is not added yet (Mac + Xcode later). |
| **Campaign** | 14 sequential levels (`level_1` … `level_14`). Level 1 unlocked; each clear unlocks the next. |
| **Events** | Always-unlocked Diario (200), Semanal (500), Mensual (1000) pieces. Same rules, separate saves. |
| **Session** | One in-progress campaign save. Events save per event id. Completed puzzles open assembled with **Desarmar y jugar**. |
| **Times** | Best / last / clear count per level id. Shown on menu cards and HUD. **No global table UI yet.** |
| **Economy** | Commons farm from campaign first-clear and Daily; rares from Weekly/Monthly and crafting (4 Area → sArea, 10×20s → infinite). Store/ads are a shortcut (no Play Billing yet). |
| **Not in the game** | Pockets, CameraTool, live IAP, ad SDK, accounts, leaderboards, daily rotation of event art, haptics. |
| **Languages** | English, Español, Deutsch, Français, Português. Menu picker. First launch follows the device, else English. |

---

## 2. How to run

```bash
npm install
npm run dev          # http://localhost:5173/
npm test             # vitest, domain only
npm run build
```

Android (needs Android Studio / SDK):

```bash
npm run android      # build web → cap sync → run
# or: npm run cap:sync && npx cap open android
```

iOS (later, on a Mac):

```bash
npx cap add ios
npm run build && npx cap sync
npx cap open ios
```

After swapping files in `public/`, hard-refresh in **dev**. Dev skips the IndexedDB atlas cache and cache-busts image URLs so replacements show up.

---

## 3. Technology

| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript (strict) | `tsconfig.json` — ES2020, bundler resolution, `noEmit` |
| Bundler | Vite 5 | `base: './'` so Capacitor file URLs work |
| Game view | Phaser 3.80 | Canvas in `#game-container`, `Scale.RESIZE`. `input.touch.capture` is **false** so HUD buttons receive fingers. |
| HUD / menu | Vanilla DOM | `#ui-layer` on top of the canvas. **Not React.** |
| Tests | Vitest (node) | `src/**/*.test.ts` — Phaser-free domain only |
| Native shell | Capacitor 6 | App id `com.puzzleadventure.app` |
| Android | Capacitor Android project | Portrait lock, status bar `#6ec8ff` |
| Persistence | `localStorage` | Progress, session, power-ups, times, locale, **period claims** |
| i18n | One typed catalog | `src/i18n/messages.ts` — `t('hud.menu')`. No i18next. |
| Piece textures | Canvas atlases + IndexedDB | DB `puzzle-adventure-atlas-v2`; skipped in `import.meta.env.DEV` |
| Audio | Web Audio oscillators | Pop / snap / click / win. No sound files. |

**HTML shell** (`index.html`): `#app` → `#game-container` (Phaser) + `#ui-layer` (menu, HUD). Viewport is `viewport-fit=cover`, no user scale.

**Phaser boot:** `src/main.ts` → `boot()` → `Phaser.Game(GameConfig)` with **only** `BootScene`. Menu and Game scenes are lazy-imported after images load.

---

## 4. Architecture

### 4.1 Layers (keep these boundaries)

```
src/app/        Phaser game config + boot (resize, native status bar)
src/domain/     Pure rules. No Phaser, no DOM.
src/data/       Levels catalog + ProgressStore (localStorage)
src/i18n/       messages.ts (all languages per key) + t()
src/engine/     Phaser runtime: board, camera, tools, atlas, scenes, audio
src/ui/         HTML menu + HUD + CSS
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
| `src/domain/types.ts` | `PieceState`, `SavedSession` v3, `SessionEvent` |
| `src/domain/product.ts` | Tunable constants, power-up keys, defaults |
| `src/domain/powerups.ts` | Catalog (tier, family, craft), grant packs, store SKUs, period keys |
| `src/domain/jigsaw.ts` | Seeded tab/slot layout from image size + piece count |
| `src/domain/snapRules.ts` | Angle 0 + distance `< 30px` |
| `src/domain/inventory.ts` | Consume / craft / applyPack |
| `src/domain/grid.ts` | Grid math, `worldToCell`, `clampSelection`, `deviceMemoryGb` |
| `src/data/ProgressStore.ts` | Unlock index, sessions, power-ups, times, locale, claims |
| `src/domain/quality.ts` | Cap huge puzzles on low-RAM devices |
| `src/domain/win.ts` | `isWon` / `countSolved` |
| `src/domain/timer.ts` | Elapsed ms + `m:ss` / `h:mm:ss` |
| `src/data/Levels.ts` | 14 campaign + 3 events, image URLs, difficulty |
| `src/engine/GameRuntime.ts` | Wires session + board + HUD + tools; chooses play mode |
| `src/engine/board/` | Sprites, layers, guide image |
| `src/engine/pipeline/` | Masked piece atlas, cache, jigsaw path |
| `src/engine/input/` | Drag/rotate/snap, pan/pinch |
| `src/engine/tools/` | Área 3×3, sÁrea 4×4, Pista 1×1 |
| `src/engine/scenes/` | Boot → Menu → Game |
| `src/i18n/messages.ts` | All UI copy: each key has `en` / `es` / `de` / `fr` / `pt` |
| `src/ui/GameHud.ts` | Round-icon in-level chrome + win card |
| `src/ui/MenuView.ts` | Hub: map, events, store, workshop, settings, start sheet |
| `src/ui/style.css` | Hub tokens, 3D buttons, dock, HUD |

### 4.3 Data flow (play)

```
MenuView  --start sheet Play-->  GameScene  -->  GameRuntime.start()
                                      ├─ quality gate → jigsaw layout → PuzzleSession
                                      ├─ PuzzleBoard (atlas + sprites)
                                      ├─ CameraController
                                      ├─ ToolManager (area / sarea / hint)
                                      └─ GameHud  ← session events
Player input → PieceInteraction / tools → PuzzleSession commands
PuzzleSession emits events → HUD + board visuals
Win → recordClear + first-clear/period grant + unlock + clear session → overlay
Leave / hide tab → session.save() (skipped if replay or already won)
```

---

## 5. Content

### 5.1 Campaign (`LEVELS`)

Generated in `src/data/Levels.ts` from `AVAILABLE_IMAGES_COUNT = 14`.

| Level | Id | Pieces | Image |
|---|---|---|---|
| 1–2 | `level_1`, `level_2` | 16 | `public/assets/Stage_1.jpg` … |
| 3–4 | | 36 | |
| 5 | `level_5` | 64 | |
| 6 | `level_6` | 36 | |
| 7 | `level_7` | 16 | |
| 8–9 | | 36 | |
| 10 | `level_10` | 64 | |
| 11–14 | | shuffled bag of 36/64/100 (seeded per decade) | through `Stage_14.jpg` |

Phaser texture keys: `stage_1` … `stage_14`. Titles include a Spanish difficulty tag (Iniciación / Fácil / Medio / Difícil).

Menu card badge (`diffLabel`): 16→C, 36→B, 64→A, 100→S, 200→SS, 500→SSS, 1000→SSSS.

**Adding a campaign level:** drop `public/assets/Stage_N.jpg`, increment `AVAILABLE_IMAGES_COUNT`, and extend `getDifficultyForLevel` if the count is not covered by the decade bag.

### 5.2 Events (`SPECIAL_LEVELS`)

Always unlocked. Not part of the campaign index.

| Id | Title | Pieces | Image |
|---|---|---|---|
| `event_daily` | Diario | 200 | `public/esp_events/daily/Stage_D.jpg` |
| `event_weekly` | Semanal | 500 | `public/esp_events/weekly/Stage_S.jpg` |
| `event_monthly` | Mensual | 1000 | `public/esp_events/monthly/Stage_M.jpg` |

Art is **static** (not actually rotated by calendar). Quality gate may reduce 200+ piece counts to 200 when `navigator.deviceMemory < 4`.

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
| **fresh** | New play, or **Desarmar y jugar** (`forceReplay`) | Scattered, unsolved | Starts at 0 | Yes (in progress) | Consumed |
| **resume** | Saved session for **this** level with at least one unsolved piece | Restored by piece id | Continues `elapsedMs` | Yes | Consumed |
| **replay** | Level already cleared and **no** in-progress save | All solved, assembled | Does not run | Never | Disabled |

Campaign uses **one** slot (`puzzle_adventure_session_v3`). Starting another campaign level overwrites it. Events use `puzzle_adventure_special_sessions_v3` keyed by level id.

`forceReplay: true` (Desarmar) always starts **fresh** (scattered), even if the level was completed.

A leftover fully-solved save is **not** treated as resume (`inProgress` requires an unsolved piece).

---

## 7. Player flows

### 7.1 Boot

1. DOM splash (logo + bar) in `#ui-layer` while `BootScene` loads campaign + event images (dev URLs get `?t=timestamp`).
2. Lazy-loads `MenuScene` and `GameScene`.
3. Starts the hub (menu).

### 7.2 Hub (menu)

Portrait home with Candy Crush-like chrome around the photo grid:

- **Top:** stacked logo · inventory chips (hint / area / 20s, open Store) · Settings gear.
- **Map tab:** 14 photo cards. Locked cards show a glossy `?`. Current unlock pulses. Best time as a gold pill.
- Tap an unlocked card → **start sheet** (thumbnail, piece count, best time, **Play**).
- **Events tab:** Daily / Weekly / Monthly as large island cards.
- **Store / Workshop tabs:** full pages (not overlays). Craft and SKUs unchanged.
- **Bottom dock:** Map · Events · Store · Workshop.
- **Settings:** language. **Reset** / **Reset events** only in `import.meta.env.DEV`.

### 7.3 In-level HUD

**Always visible:** progress capsule, timer/record glass pill, hold Peek.  
**Top-left tab:** chevron slides the Map button out; tap again to hide.  
**Bottom-right tab:** chevron slides the tool row in beside it (Infinite, 20s, Area, sArea, Hint), along the bottom edge so it does not cover the board. Labels are `aria-label` / `title`. After a hold-tool is used, the tray hides. **Scatter and play** is a round replay control when assembled/won; the tray opens on win.

HUD `pointer-events` are on **tabs, open buttons, Peek, and timer chips only**, not the full-width bars, so the canvas stays hittable.

### 7.4 Assemble

1. Drag a piece (pop SFX, slight scale-up).
2. Short drag (`< 10px`) on release = **rotate 90°** (click SFX).
3. Release near the correct slot, **upright**, within **30px** → snap (two-note chime), `placePiece`, ink/coral/gold outline along the jigsaw shape.
4. Solved sprites move to the solved layer and lose interaction. Hint uses the same outline glow when the piece locks.

Pan: drag empty space. Pinch: two fingers, zoom 0.15–3. Camera is disabled while a HUD tool is held. In-level sky matches the hub (`#6ec8ff`); pieces scatter off the photo; the opening view fits the whole scatter so every piece is on screen.

### 7.5 Win

- Timer pauses. `recordClear(levelId, elapsedMs)` writes best/last/clears.
- Campaign: `completeLevel`. If the unlock index **increases**, grant first-clear pack.
- Events: grant the period pack **once** (UTC day / ISO week / `YYYY-MM`). Replay and already-claimed periods: no pack.
- In-progress session for that puzzle is **cleared**.
- Overlay: cream win card (pop-in), time, récord / nuevo récord, **reward chips if granted**, **Scatter and play**, **Map**.
- HUD also gains **Desarmar y jugar** so a second attempt does not require leaving.

Leaving after a win does **not** write a solved session back (that was the “button disappeared until I visited another level” bug).

### 7.6 Desarmar y jugar

Clears the relevant session and `scene.restart({ levelId, forceReplay: true })` → fresh scatter. After that run is won, the disarm control is shown again.

---

## 8. Systems

### 8.1 Pieces and layout

- Grid from image aspect × requested count (`computeGrid`).
- Seeded tabs/slots (`buildJigsawLayout`); seed = hash of `levelId`, grid, image size.
- Scatter in the four side bands around the board (`BOARD_SCATTER_MARGIN` 560px, `BOARD_SCATTER_GAP` 40px so centers stay off the photo), random 0/90/180/270°. Initial camera fits that scatter world so the photo and all pieces are visible without zooming.

### 8.2 Atlas pipeline

1. Fingerprint a 32×32 downscale of the photo (so replacing `Stage_N.jpg` invalidates cache).
2. Cache key: `levelId:cols x rows:seed:imageKey:fingerprint`.
3. Draw each piece with a clipped jigsaw path onto atlas canvases (max 4096).
4. Memory map always; **IndexedDB only in production builds**.

If pieces look like an **old photo** after you replaced art: hard-refresh in dev, or bump/clear `puzzle-adventure-atlas-v2` in production.

### 8.3 Power-ups (catalog + farm)

Inventory is a flat `Record<PowerupKey, number>` in `puzzle_adventure_powerups_v1`, shared across all levels. **Add a new power-up as one row** in [`src/domain/powerups.ts`](../src/domain/powerups.ts) (`POWERUP_DEFS`); do not special-case craft or grants.

| Id | Tier | Family | Default | Craft | Effect |
|---|---|---|---|---|---|
| `hint` | common | place | 5 | none | Hold, aim 1 cell. Animates that piece (or a random unsolved neighbor) into place, then `placePiece` + consume. |
| `area` | common | gather | 5 | **4 → 1 `sarea`** | Hold: 3×3 gather. |
| `reveal_temp` | common | reveal | 8 | **10 → 1 `reveal_perm`** | Ghost 20s. Ignored if perm is on. |
| `sarea` | rare | gather | 0 | — | Hold: 4×4 gather. |
| `reveal_perm` | rare | reveal | 0 | — | Toggle ghost (alpha 0.3). Consumes on turn-on. |

Commons share the same store value. Hint exists so not every common is hoarded for craft. Rares are the farm output.

Hold-tools track **window** `pointermove`. Confirm uses Phaser `transformPointer(pageX, pageY)`.

**Craft:** HUD swipe (Área → sÁrea, 20s → ∞) plus hub **Workshop** tab (explicit convert buttons). Costs come from the catalog (`craftCost`), not hardcoded 2/3.

**Sources (never on replay):**

| Source | When | Pack |
|---|---|---|
| Campaign first clear | `completeLevel` actually bumps unlock | `{ hint: 1, area: 1, reveal_temp: 1 }` |
| Daily | first win this UTC day | `{ hint: 2, area: 2, reveal_temp: 2 }` |
| Weekly | first win this ISO week | `{ hint: 2, area: 4, sarea: 1 }` |
| Monthly | first win this `YYYY-MM` | `{ hint: 3, reveal_temp: 5, sarea: 2, reveal_perm: 1 }` |
| Rewarded ad | DEV simulate; cap **5 / UTC day** | 1 random common |
| `pack_handy` | IAP SKU listed, not billed | 10 hint + 10 area + 10 temp |
| `pack_rare` | IAP SKU listed, not billed | 3 sArea + 2 infinite |

Period keys live in `puzzle_adventure_claims_v1`. Replay and a second win in the same period show the existing win card with **no** reward list.

**Store** is a shortcut for the same packs, not a second currency. IAP buttons are “Coming soon”. Ad simulate is **DEV-only**.

Replay mode: tools and reveals that consume charges are no-ops. **Ver** (eye hold) still works.

### 8.4 Timer and times

- Tick from Phaser `update` delta. HUD refreshes ~every 200ms.
- On each win: `{ bestMs, lastMs, clears }` in `puzzle_adventure_times_v1`.
- HUD shows **Récord**; overlay shows this run vs best.
- Menu cards show best if present.
- **Future global table:** read `ProgressStore` times (add a `getTimes()` if you need the full map). Do not invent a second store.

### 8.5 Quality gate

If requested pieces **> 200** and `navigator.deviceMemory < 4`, count becomes 200 and HUD toasts that RAM limited the puzzle.

### 8.6 Audio

`AudioService` singleton: generated blips. `playWin` on `won`. Resume AudioContext on first gesture.

### 8.7 Native

- Capacitor app name **Puzzle Adventure**, id `com.puzzleadventure.app`, `webDir: dist`.
- Android `MainActivity` = `BridgeActivity`, **portrait**.
- Status bar dark icons / `#6ec8ff` from `bootstrap.ts` on native only.
- Haptics: **not wired**.

### 8.8 Languages

Shipped: `en` (canonical keys + fallback), `es`, `de`, `fr`, `pt`.

Resolution: saved `puzzle_adventure_locale_v1` → first matching `navigator.languages` (`pt-BR` → `pt`) → `en`.

Picker: Settings on the hub (gear). Changing language rebuilds the hub. In-level HUD uses the locale at scene start (return to map to switch).

All player-facing copy lives in [`src/i18n/messages.ts`](../src/i18n/messages.ts): one object per string, all five languages together. `t('group.key')` reads the active locale. Do not hardcode HUD/menu strings.

**Add a string:** one `loc({ en, es, de, fr, pt })` under the right group. Missing a language fails `tsc`.

**Remove a string:** delete that object.

**Add a language:** extend `LocaleId` and every `loc({...})`; `tsc` lists gaps. Also add the picker row in `SUPPORTED_LOCALES`.

---

## 9. Persistence reference

| Key | Contents |
|---|---|
| `puzzle_adventure_progress_v2` | Campaign `highestUnlockedIndex` (string int). Migrates legacy `puzzle_adventure_progress` array. |
| `puzzle_adventure_session_v3` | Single campaign `SavedSession`. |
| `puzzle_adventure_special_sessions_v3` | Map of event id → `SavedSession`. |
| `puzzle_adventure_powerups_v1` | Five counts. Missing keys filled from `DEFAULT_POWERUPS`. |
| `puzzle_adventure_times_v1` | Map of level id → `{ bestMs, lastMs, clears }`. |
| `puzzle_adventure_locale_v1` | Saved locale id (`en` / `es` / `de` / `fr` / `pt`). Absent = follow device, else `en`. |
| `puzzle_adventure_claims_v1` | `{ eventPeriods, adsDate, adsCount }`. Event id → period key; ads reset each UTC day. |
| IndexedDB `puzzle-adventure-atlas-v2` | Packed piece PNGs + frames. |

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
| `BOARD_SCATTER_MARGIN` | 560 | Scatter world padding |
| `BOARD_SCATTER_GAP` | 40 | Extra gap so piece centers stay off the photo |
| `CAMERA_FIT_VIEW_PAD` | 80 | Padding around the scatter world for the opening zoom |
| `CAMERA_ZOOM_MIN/MAX` | 0.15 / 3 | Pinch limits |
| `CAMERA_FIT_ZOOM_*` | 0.15 / 1.2 | Initial fit clamp |
| `QUALITY_SOFT_CAP` | 200 | Low-RAM piece cap |
| `QUALITY_LOW_RAM_GB` | 4 | Gate threshold |
| `ATLAS_MAX_SIZE` | 4096 | Atlas canvas max |
| `DEFAULT_POWERUPS` | 8 / 5 / 5 / 0 / 0 | New player inventory (commons only) |

Craft costs live on `POWERUP_DEFS` in `src/domain/powerups.ts` (4 Area, 10 temp). Grant packs and `STORE_SKUS` are in the same file.

Piece interaction tap threshold: **10px** (`PieceInteraction.ts`). Área / sÁrea grid sizes: **3** and **4** (`GameRuntime`).

---

## 11. Tests

`npm test` — Vitest, node environment.

| File | Covers |
|---|---|
| `PuzzleSession.test.ts` | Ids, scatter, snap→win, hint consume, resume by id, **no save after win**, first-clear / period grants |
| `grid.test.ts` | Grid, world→cell, clamp selection |
| `pieceId.test.ts` | `level:col:row` parse |
| `snapRules.test.ts` | Distance / angle |
| `inventory.test.ts` | Consume / craft 4 and 10 / applyPack |
| `powerups.test.ts` | Period keys, pack entries |
| `ProgressStore.test.ts` | Claims, ad cap, craft |
| `win.test.ts` | All solved |
| `i18n.test.ts` | Interpolation, `pt-BR`→`pt`, saved locale, English fallback |

Engine, HUD, and Capacitor are **not** unit-tested. After HUD/layout changes, verify in the browser at `http://localhost:5173/`.

---

## 12. Invariants (do not break)

1. Piece id = `` `${levelId}:${col}:${row}` ``.
2. Only `placePiece` marks solved + may emit `won`.
3. Campaign has **one** in-progress save; events have one per event id.
4. Never persist an all-solved board; replay is derived from unlocks / best times.
5. Domain must stay importable from Vitest without Phaser.
6. HUD tools that aim on the board must track **page** coordinates (window), not canvas-only pointermove.
7. Atlas cache must include a **pixel fingerprint**, not only level id + size.
8. `#ui-layer` is `pointer-events: none`; interactive children opt in. Do not set `#ui-layer > * { pointer-events: auto }` (it makes the full HUD strips steal the board).
9. Player-facing copy lives in `src/i18n/messages.ts`. Add or delete one object per string (all languages in that object).
10. Power-up grants happen **once** (campaign unlock bump, or event period key). Do not grant on replay.

---

## 13. Intentional gaps / next iterations

Use this as the backlog seed, not as committed scope.

| Item | Status now | Suggested direction |
|---|---|---|
| **Global times table** | Data exists (`times_v1`, HUD + menu cards) | New menu screen reading `ProgressStore`; do not add a second store |
| **Play Billing / ads SDK** | SKUs listed; DEV simulate-ad | Wire IAP; replace simulate with rewarded ads |
| **Event rotation** | Static JPGs | Calendar-based art / ids; keep `eventType` on `LevelData` |
| **iOS** | Not added | `npx cap add ios` on a Mac |
| **Play Store** | No | Signing, store listing, privacy |
| **Haptics** | Unused | Capacitor Haptics on snap/win |
| **Sound assets** | Synth only | Optional files; keep `AudioService` as the single API |
| **Accounts / cloud** | None | If added, wrap `ProgressStore` rather than scattering `localStorage` |
| **Dev buttons in production** | Reset / Reset events in Settings, DEV only | — |
| **Reset vs times** | Reset progress does not clear campaign times | Product decision: wipe or keep récords |
| **Campaign session slot** | One level at a time | Per-level campaign saves if players juggle levels |

---

## 14. Common change recipes

**New campaign image for an existing slot:** replace `public/assets/Stage_N.jpg`, hard-refresh in dev.

**New event:** add `LevelData` in `SPECIAL_LEVELS` + file under `public/esp_events/`. BootScene already loads all specials.

**New power-up:** add one `POWERUP_DEFS` row (`id`, `tier`, `family`, optional `craftsTo` / `craftCost`), extend `PowerupKey` + `DEFAULT_POWERUPS` in `product.ts`, HUD control + session command. Grants and store iterate the catalog.

**Change snap feel:** `SNAP_DISTANCE_PX` only.

**Change Área size:** `GameRuntime` `new AreaTool(..., 3 | 4, ...)`. `useArea` treats `size >= 4` as sÁrea charges.

**New UI string:** add one `loc({ en, es, de, fr, pt })` in [`src/i18n/messages.ts`](src/i18n/messages.ts). `tsc` fails if a language is missing. Use `t('group.key', { n })` in HUD/menu — never hardcode player-facing copy.

**Remove a UI string:** delete that object in `messages.ts`.

**Add a language:** add the id to `LocaleId` and `SUPPORTED_LOCALES`, then fill it in every `loc({...})` (`tsc` lists the rest).

**Do not** reintroduce pockets, per-piece canvases (use the atlas), or a second win/snap implementation in the engine.

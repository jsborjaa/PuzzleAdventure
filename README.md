# Puzzle Adventure

Phone jigsaw (Android first, iOS-ready): Phaser 3, TypeScript, Vite, Capacitor. Portrait and landscape.

The full product + architecture reference (flows, storage, Play Billing, invariants, backlog) is **[docs/GAME.md](docs/GAME.md)**. Read that before changing gameplay, persistence, HUD, or store.

## Web (local only)

```bash
npm install
npm run dev
```

```bash
npm test
npm run build
```

Dev server: `http://localhost:5173/`. There is no public web store (no Vercel / GitHub Pages). Play Billing does not run in a browser.

**Phone layout on this PC:** the localhost bar has **Desktop / iPhone / Pixel / Rotate** (dev only; not in production). Or Chrome DevTools → Toggle device toolbar (Ctrl+Shift+M) → pick **iPhone 14** or **Pixel 7**, then rotate. Hard-reload after switching devices.

## Android

Needs Android Studio / SDK. App id: `com.puzzleadventure.app`.

```bash
npm run android
```

Or `npx cap open android` after `npm run cap:sync`.

Signed Play bundle:

```bash
npm run android:bundle
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`. Upload to **internal testing**. IAP and ads: install **from Play**, not a sideloaded APK. Details in [docs/GAME.md](docs/GAME.md).

## iOS (later, Mac + Xcode)

```bash
npx cap add ios
npm run build
npx cap sync
npx cap open ios
```

## Play (short)

Drag pieces from the **tray** (tap to rotate), pinch to zoom, pan empty space on the board. Hub: Map / Events / Store / Workshop. Hold **Peek** in a level. Exit, Peek, Commons, and Rares sit in the play chrome. Completed levels open assembled; **Scatter and play** shuffles into the tray again. Language is in Settings. Details in [docs/GAME.md](docs/GAME.md).

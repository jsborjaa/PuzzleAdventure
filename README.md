# Puzzle Adventure

Portrait jigsaw for phones (Android first, iOS-ready): Phaser 3, TypeScript, Vite, Capacitor.

The full product + architecture reference (flows, storage, invariants, backlog) is **[docs/GAME.md](docs/GAME.md)**. Read that before changing gameplay, persistence, or HUD.

## Web

```bash
npm install
npm run dev
```

```bash
npm test
npm run build
```

Dev server: `http://localhost:5173/`. After replacing files in `public/`, hard-refresh.

## Android

Needs Android Studio / SDK. App id: `com.puzzleadventure.app`.

```bash
npm run android
```

Or `npx cap open android` after `npm run cap:sync`.

## iOS (later, Mac + Xcode)

```bash
npx cap add ios
npm run build
npx cap sync
npx cap open ios
```

## Play (short)

Drag pieces, tap to rotate, pinch to zoom, pan empty space. Hold **View** to peek. Bottom bar: reveal, Area / sArea, Hint. Completed levels open assembled; **Scatter and play** (localized) scatters again. Language picker is on the menu. Details in [docs/GAME.md](docs/GAME.md).

# Photo drop folders (ingest)

Put originals here on this PC, then run the ingest commands. JPEGs are gitignored; these folders stay in the repo so you can find them.

## Campaign (map)

Folder: `content/campaign/`

Name files with the **level number**. That number is the level. No title needed.

Examples: `0001.jpg`, `14.jpg`, `0347.jpg`

Accepted: `.jpg` `.jpeg` `.png` `.webp`

```bash
npm run ingest -- content/campaign
```

## Events (not on the map)

Do **not** put `/` in the filename (Windows forbids it). `/` only means a folder.

Easiest: put everything in `content/events/2026-09/` with a hyphen:

- `daily-01.jpg` — Diario for day 1
- `daily-03.jpg` — Diario for day 3
- `weekly-W36.jpg` — that ISO week
- `monthly.jpg` — Mensual

Same thing with folders (the file itself is still only `01.jpg`):

- folder `daily`, file `01.jpg`
- folder `weekly`, file `W36.jpg`

```bash
npm run ingest:events -- content/events/2026-09
```

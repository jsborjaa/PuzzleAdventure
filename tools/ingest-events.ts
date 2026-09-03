import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { EVENT_PIECE_COUNTS } from '../src/domain/campaignDifficulty.ts';
import {
  hashBuffer,
  listImages,
  loadDotEnv,
  makeThumb,
  parseArg,
  positionalDir,
  serviceClient,
  uploadBoth,
} from './ingest-lib.ts';

loadDotEnv();

const dir = positionalDir(`content/events/${new Date().toISOString().slice(0, 7)}`);
const month = basename(dir);
if (!/^\d{4}-\d{2}$/.test(month)) {
  console.error(`Event folder must be YYYY-MM, got ${month}`);
  process.exit(1);
}

const supabase = serviceClient();

async function upsertEvent(
  eventType: 'daily' | 'weekly' | 'monthly',
  periodKey: string,
  filePath: string,
) {
  const buf = readFileSync(filePath);
  const hash = hashBuffer(buf);
  const id = `event_${eventType}_${periodKey}`;
  const { data: existing } = await supabase.from('event_puzzles').select('content_hash').eq('id', id).maybeSingle();
  if (existing?.content_hash === hash) {
    console.log(`skip ${id} (unchanged)`);
    return;
  }
  const thumb = await makeThumb(buf);
  const fullPath = `events/full/${eventType}/${periodKey}.jpg`;
  const thumbPath = `events/thumbs/${eventType}/${periodKey}.jpg`;
  await uploadBoth(supabase, fullPath, thumbPath, buf, thumb);
  const { error } = await supabase.from('event_puzzles').upsert({
    id,
    event_type: eventType,
    period_key: periodKey,
    piece_count: EVENT_PIECE_COUNTS[eventType],
    image_path: fullPath,
    thumb_path: thumbPath,
    content_hash: hash,
  });
  if (error) throw error;
  console.log(`upsert ${id}`);
}

const dailyDir = join(dir, 'daily');
for (const file of listImages(dailyDir)) {
  const day = parseInt(file.replace(/\D+/g, ''), 10);
  if (!Number.isFinite(day) || day < 1 || day > 31) {
    console.warn(`skip daily ${file}`);
    continue;
  }
  const period = `${month}-${String(day).padStart(2, '0')}`;
  await upsertEvent('daily', period, join(dailyDir, file));
}

const weeklyDir = join(dir, 'weekly');
for (const file of listImages(weeklyDir)) {
  const week = file.match(/W(\d{1,2})/i)?.[1];
  if (!week) {
    console.warn(`skip weekly ${file}: use W36.jpg`);
    continue;
  }
  const period = `${month.slice(0, 4)}-W${String(week).padStart(2, '0')}`;
  await upsertEvent('weekly', period, join(weeklyDir, file));
}

/** Flat names in the month folder (Windows: no `/` in the filename). */
for (const file of listImages(dir)) {
  const daily = file.match(/^daily[-_]?(\d{1,2})\./i);
  if (daily) {
    const day = parseInt(daily[1]!, 10);
    if (day >= 1 && day <= 31) {
      await upsertEvent('daily', `${month}-${String(day).padStart(2, '0')}`, join(dir, file));
    }
    continue;
  }
  const weekly = file.match(/^weekly[-_]?W(\d{1,2})\./i);
  if (weekly) {
    const week = weekly[1]!;
    await upsertEvent('weekly', `${month.slice(0, 4)}-W${String(week).padStart(2, '0')}`, join(dir, file));
  }
}

const monthlyFile = ['monthly.jpg', 'monthly.jpeg', 'monthly.png', 'monthly.webp']
  .map((name) => join(dir, name))
  .find((p) => existsSync(p));
if (monthlyFile) await upsertEvent('monthly', month, monthlyFile);

const pruneBefore = parseArg('--prune-art-before');
if (pruneBefore) {
  const { data: rows, error } = await supabase
    .from('event_puzzles')
    .select('id, period_key, image_path, thumb_path, event_type');
  if (error) throw error;
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);
  for (const row of rows ?? []) {
    const key = String(row.period_key);
    if (key === today || key === thisMonth) continue;
    const monthStamp = key.includes('-W') ? `${key.slice(0, 4)}-01` : key.slice(0, 7);
    if (monthStamp >= pruneBefore) continue;
    await supabase.storage.from('level-images').remove([row.image_path, row.thumb_path]);
    console.log(`pruned art ${row.id} (row kept)`);
  }
}

console.log('event ingest done');

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDifficultyForLevel } from '../src/domain/campaignDifficulty.ts';
import {
  hashBuffer,
  listImages,
  loadDotEnv,
  makeThumb,
  positionalDir,
  serviceClient,
  uploadBoth,
} from './ingest-lib.ts';

loadDotEnv();

const dir = positionalDir('content/campaign');
const supabase = serviceClient();
const files = listImages(dir);
if (files.length === 0) {
  console.error(`No images in ${dir}`);
  process.exit(1);
}

for (const file of files) {
  const num = parseInt(file.replace(/\D+/g, ''), 10);
  if (!Number.isFinite(num) || num < 1) {
    console.warn(`skip ${file}: need a numeric filename`);
    continue;
  }
  const buf = readFileSync(join(dir, file));
  const hash = hashBuffer(buf);
  const id = `level_${num}`;
  const { data: existing } = await supabase.from('levels').select('content_hash').eq('id', id).maybeSingle();
  if (existing?.content_hash === hash) {
    console.log(`skip ${id} (unchanged)`);
    continue;
  }
  const thumb = await makeThumb(buf);
  const fullPath = `campaign/full/${String(num).padStart(4, '0')}.jpg`;
  const thumbPath = `campaign/thumbs/${String(num).padStart(4, '0')}.jpg`;
  await uploadBoth(supabase, fullPath, thumbPath, buf, thumb);
  const { error } = await supabase.from('levels').upsert({
    id,
    campaign_index: num,
    piece_count: getDifficultyForLevel(num),
    image_path: fullPath,
    thumb_path: thumbPath,
    is_published: true,
    content_hash: hash,
  });
  if (error) throw error;
  console.log(`upsert ${id}`);
}

console.log(`done (${files.length} files scanned)`);

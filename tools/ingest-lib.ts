import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

export function loadDotEnv(): void {
  for (const name of ['.env.local', '.env']) {
    if (!existsSync(name)) continue;
    for (const line of readFileSync(name, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

export function serviceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function hashBuffer(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex').slice(0, 20);
}

export async function makeThumb(buf: Buffer): Promise<Buffer> {
  return sharp(buf).rotate().resize({ width: 256, withoutEnlargement: true }).jpeg({ quality: 72 }).toBuffer();
}

export async function uploadBoth(
  supabase: SupabaseClient,
  fullPath: string,
  thumbPath: string,
  full: Buffer,
  thumb: Buffer,
): Promise<void> {
  const fullUp = await supabase.storage.from('level-images').upload(fullPath, full, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (fullUp.error) throw fullUp.error;
  const thumbUp = await supabase.storage.from('level-images').upload(thumbPath, thumb, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (thumbUp.error) throw thumbUp.error;
}

export function listImages(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => IMAGE_EXT.has(extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function parseArg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i < 0) return undefined;
  return process.argv[i + 1];
}

export function positionalDir(fallback: string): string {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--') && process.argv[process.argv.indexOf(a) - 1] !== '--prune-art-before');
  return resolve(args[0] ?? fallback);
}

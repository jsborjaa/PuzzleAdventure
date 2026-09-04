import type { PowerupKey } from '../domain/product';
import { packEntries, type PowerupPack } from '../domain/powerups';
import { t, type MessageKey } from '../i18n';

const NAMES: Record<PowerupKey, MessageKey> = {
  hint: 'hud.hint',
  lucky: 'hud.lucky',
  area: 'hud.area',
  sarea: 'hud.sarea',
  reveal_temp: 'hud.revealTemp',
  reveal_perm: 'hud.revealPerm',
  solver: 'hud.solver',
};

export function powerupName(id: PowerupKey): string {
  return t(NAMES[id]);
}

export function formatPack(pack: PowerupPack): string {
  return packEntries(pack)
    .map((row) => t('hud.rewardItem', { name: powerupName(row.id), n: row.n }))
    .join(' · ');
}

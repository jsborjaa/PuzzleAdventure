import { QUALITY_LOW_RAM_GB, QUALITY_SOFT_CAP } from './product';
import { deviceMemoryGb } from './grid';

export function applyQualityGate(requested: number): { count: number; reduced: boolean } {
  if (requested <= QUALITY_SOFT_CAP) {
    return { count: requested, reduced: false };
  }
  const mem = deviceMemoryGb();
  if (mem !== undefined && mem < QUALITY_LOW_RAM_GB) {
    return { count: QUALITY_SOFT_CAP, reduced: true };
  }
  return { count: requested, reduced: false };
}

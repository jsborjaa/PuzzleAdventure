/** Campaign levels shown on one map page. */
export const MAP_PAGE_SIZE = 10;

export function pageCount(total: number, pageSize: number = MAP_PAGE_SIZE): number {
  if (total <= 0) return 1;
  return Math.ceil(total / pageSize);
}

export function clampPage(page: number, total: number, pageSize: number = MAP_PAGE_SIZE): number {
  return Math.min(Math.max(1, page), pageCount(total, pageSize));
}

export function pageBounds(
  page: number,
  total: number,
  pageSize: number = MAP_PAGE_SIZE,
): { start: number; end: number } {
  if (total <= 0) return { start: 1, end: 0 };
  const p = clampPage(page, total, pageSize);
  const start = (p - 1) * pageSize + 1;
  return { start, end: Math.min(total, p * pageSize) };
}

export function pageForIndex(index: number, total: number, pageSize: number = MAP_PAGE_SIZE): number {
  if (total <= 0) return 1;
  const i = Math.min(Math.max(1, index), total);
  return Math.ceil(i / pageSize);
}

export function shiftPage(
  page: number,
  delta: number,
  total: number,
  pageSize: number = MAP_PAGE_SIZE,
): number {
  return clampPage(page + delta, total, pageSize);
}

/** RPC args that cover [start, end], possibly with one extra row to filter. */
export function pageQuery(
  page: number,
  total: number,
  pageSize: number = MAP_PAGE_SIZE,
): { start: number; end: number; around: number; radius: number } {
  const { start, end } = pageBounds(page, total, pageSize);
  if (end < start) return { start, end, around: 1, radius: pageSize - 1 };
  const around = Math.floor((start + end) / 2);
  const radius = Math.max(around - start, end - around);
  return { start, end, around, radius };
}

export function campaignIndexOf(level: { id: string; campaignIndex?: number }): number {
  return level.campaignIndex ?? parseInt(level.id.replace('level_', ''), 10);
}

export function sliceByPage<T>(
  rows: T[],
  page: number,
  total: number,
  indexOf: (row: T) => number,
  pageSize: number = MAP_PAGE_SIZE,
): T[] {
  const { start, end } = pageBounds(page, total, pageSize);
  return rows
    .filter((row) => {
      const i = indexOf(row);
      return Number.isFinite(i) && i >= start && i <= end;
    })
    .sort((a, b) => indexOf(a) - indexOf(b));
}

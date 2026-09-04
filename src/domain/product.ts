export const SNAP_DISTANCE_PX = 30;
export const REVEAL_TEMP_MS = 20_000;
export const REVEAL_PERM_ALPHA = 0.3;
export const REVEAL_TEMP_ALPHA = 0.3;
export const REVEAL_EYE_ALPHA = 0.4;

/** Padding around the photo for pan/peek. Pieces live in the tray, not in this band. */
export const BOARD_WORLD_PAD = 180;
export const CAMERA_ZOOM_MIN = 0.15;
export const CAMERA_ZOOM_MAX = 3;
export const CAMERA_FIT_ZOOM_MIN = 0.15;
export const CAMERA_FIT_ZOOM_MAX = 3;
export const CAMERA_FIT_VIEW_PAD = 48;
export const CAMERA_BOUNDS_PADDING = 4000;

export const QUALITY_SOFT_CAP = 200;
export const QUALITY_LOW_RAM_GB = 4;
export const ATLAS_MAX_SIZE = 4096;

export type PowerupKey = 'reveal_temp' | 'area' | 'hint' | 'sarea' | 'reveal_perm' | 'lucky' | 'solver';
export type ToolId = PowerupKey;
export type PlayMode = 'fresh' | 'resume' | 'replay';

export const DEFAULT_POWERUPS: Record<PowerupKey, number> = {
  reveal_temp: 0,
  area: 0,
  hint: 0,
  sarea: 0,
  reveal_perm: 0,
  lucky: 0,
  solver: 0,
};

/**
 * Force simulated IAP on every platform when true.
 * When false, Vite DEV still simulates; native production uses Play Billing;
 * a production web build does not grant packs (no Play on the web).
 */
export const SIMULATE_IAP = false;

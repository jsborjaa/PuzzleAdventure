export const SNAP_DISTANCE_PX = 30;
export const REVEAL_TEMP_MS = 20_000;
export const REVEAL_PERM_ALPHA = 0.3;
export const REVEAL_TEMP_ALPHA = 0.3;
export const REVEAL_EYE_ALPHA = 0.4;

export const BOARD_SCATTER_MARGIN = 560;
export const BOARD_SCATTER_GAP = 40;
export const CAMERA_ZOOM_MIN = 0.15;
export const CAMERA_ZOOM_MAX = 3;
export const CAMERA_FIT_ZOOM_MIN = 0.15;
export const CAMERA_FIT_ZOOM_MAX = 1.2;
export const CAMERA_FIT_VIEW_PAD = 80;
export const CAMERA_BOUNDS_PADDING = 4000;

export const QUALITY_SOFT_CAP = 200;
export const QUALITY_LOW_RAM_GB = 4;
export const ATLAS_MAX_SIZE = 4096;

export type PowerupKey = 'reveal_temp' | 'area' | 'hint' | 'sarea' | 'reveal_perm';
export type ToolId = 'area' | 'sarea' | 'hint';
export type PlayMode = 'fresh' | 'resume' | 'replay';

export const DEFAULT_POWERUPS: Record<PowerupKey, number> = {
  reveal_temp: 8,
  area: 5,
  hint: 5,
  sarea: 0,
  reveal_perm: 0,
};

/** Temporary local grants for IAP SKUs until Play Billing is wired. */
export const SIMULATE_IAP = true;

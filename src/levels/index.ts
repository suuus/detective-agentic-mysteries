import { CRUISE_CONFIG } from "./cruise.js";

export const LEVELS = {
  cruise: CRUISE_CONFIG,
} as const;

export type LevelId = keyof typeof LEVELS;

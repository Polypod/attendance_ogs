// src/types/config.ts - Configuration type definitions

export interface CategoryConfig {
  value: string;
  label: string;
  description: string;
  order: number;
}

export interface BeltLevelConfig {
  value: string;
  label: string;
  rank: number;
  color: string;
}

export interface SystemConfig {
  version: string;
  categories: CategoryConfig[];
  belt_levels: BeltLevelConfig[];
}

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

export type UnmappedCategoryAction = 'report' | 'skip' | 'default';

export interface MemberSyncConfig {
  /** Member category name in OGS -> categories used here. */
  category_map: Record<string, string[]>;
  /** How to treat members whose OGS category is missing or unmapped. */
  unmapped_category_action: UnmappedCategoryAction;
  /** Categories applied when unmapped_category_action is 'default'. */
  default_categories: string[];
  /** OGS grade -> belt_level here. null clears the belt field. */
  belt_map: Record<string, string | null>;
  /** Grades whose level comes from kyuDanGrade rather than from grade itself. */
  dan_grades: string[];
  /** kyuDanGrade -> belt_level, used for the grades listed in dan_grades. */
  dan_map: Record<string, string | null>;
  /** Deactivate students whose member disappeared from the export entirely. */
  deactivate_missing: boolean;
}

export interface SystemConfig {
  version: string;
  categories: CategoryConfig[];
  belt_levels: BeltLevelConfig[];
  member_sync?: MemberSyncConfig;
}

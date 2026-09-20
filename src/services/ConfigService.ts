// src/services/ConfigService.ts - Configuration service singleton

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  SystemConfig,
  CategoryConfig,
  BeltLevelConfig,
  MemberSyncConfig,
  UnmappedCategoryAction,
} from '../types/config';
import { logger } from '../utils/logger';

export class ConfigService {
  private static instance: ConfigService;
  private config!: SystemConfig;

  private constructor() {}

  /**
   * Initialize the configuration service by loading the YAML file
   * This must be called during application startup
   */
  public static async initialize(): Promise<void> {
    const instance = ConfigService.getInstance();
    const configPath = path.join(process.cwd(), 'config', 'system.yaml');

    try {
      // Check if config file exists
      if (!fs.existsSync(configPath)) {
        throw new Error(`Configuration file not found at: ${configPath}`);
      }

      // Read and parse YAML file
      const fileContents = fs.readFileSync(configPath, 'utf8');
      const config = yaml.load(fileContents) as SystemConfig;

      // Validate config structure
      instance.validateConfig(config);

      // Store config
      instance.config = config;

      logger.info('config_loaded', {
        categories: config.categories.length,
        beltLevels: config.belt_levels.length,
      });
    } catch (error: any) {
      logger.error('config_load_failed', { message: error?.message }, error);
      throw error;
    }
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  /**
   * Get the singleton instance only if configuration has been initialized.
   *
   * This is primarily intended for synchronous validation paths (e.g. Mongoose
   * schema validators) where we must not throw if config hasn't been loaded yet.
   */
  public static tryGetInitializedInstance(): ConfigService | null {
    const instance = ConfigService.instance;
    if (!instance) {
      return null;
    }

    // Note: `config` is only set by `initialize()`.
    if (!(instance as any).config) {
      return null;
    }

    return instance;
  }

  /**
   * Validate config structure
   */
  private validateConfig(config: any): void {
    if (!config) {
      throw new Error('Configuration is empty');
    }

    if (!config.version) {
      throw new Error('Configuration missing version field');
    }

    if (!Array.isArray(config.categories) || config.categories.length === 0) {
      throw new Error('Configuration missing or empty categories array');
    }

    if (!Array.isArray(config.belt_levels) || config.belt_levels.length === 0) {
      throw new Error('Configuration missing or empty belt_levels array');
    }

    // Validate each category has required fields
    config.categories.forEach((cat: any, index: number) => {
      if (!cat.value || !cat.label || typeof cat.order !== 'number') {
        throw new Error(`Category at index ${index} missing required fields (value, label, order)`);
      }
    });

    // Validate each belt level has required fields
    config.belt_levels.forEach((belt: any, index: number) => {
      if (!belt.value || !belt.label || typeof belt.rank !== 'number') {
        throw new Error(`Belt level at index ${index} missing required fields (value, label, rank)`);
      }
    });

    // Check for duplicate category values
    const categoryValues = config.categories.map((c: CategoryConfig) => c.value);
    const uniqueCategoryValues = new Set(categoryValues);
    if (categoryValues.length !== uniqueCategoryValues.size) {
      throw new Error('Duplicate category values found in configuration');
    }

    // Check for duplicate belt level values
    const beltValues = config.belt_levels.map((b: BeltLevelConfig) => b.value);
    const uniqueBeltValues = new Set(beltValues);
    if (beltValues.length !== uniqueBeltValues.size) {
      throw new Error('Duplicate belt level values found in configuration');
    }

    this.validateMemberSync(config, new Set(categoryValues), new Set(beltValues));
  }

  /**
   * Validate the optional member_sync block.
   *
   * Validation happens here rather than at sync time so a typo in the mapping
   * surfaces on startup instead of silently skipping members during a run.
   * The valid values are passed in because `this.config` is not assigned yet.
   */
  private validateMemberSync(
    config: any,
    validCategories: Set<string>,
    validBeltLevels: Set<string>
  ): void {
    const memberSync = config.member_sync;
    if (memberSync === undefined || memberSync === null) {
      return;
    }

    if (typeof memberSync !== 'object' || Array.isArray(memberSync)) {
      throw new Error('member_sync must be an object');
    }

    const allowedActions: UnmappedCategoryAction[] = ['report', 'skip', 'default'];
    if (!allowedActions.includes(memberSync.unmapped_category_action)) {
      throw new Error(
        `member_sync.unmapped_category_action must be one of: ${allowedActions.join(', ')}`
      );
    }

    if (memberSync.category_map !== undefined) {
      if (typeof memberSync.category_map !== 'object' || Array.isArray(memberSync.category_map)) {
        throw new Error('member_sync.category_map must be an object');
      }

      for (const [sourceCategory, targets] of Object.entries(memberSync.category_map)) {
        if (!Array.isArray(targets) || targets.length === 0) {
          throw new Error(
            `member_sync.category_map.${sourceCategory} must be a non-empty array of categories`
          );
        }

        for (const target of targets) {
          if (!validCategories.has(target)) {
            throw new Error(
              `member_sync.category_map.${sourceCategory} refers to unknown category: ${target}`
            );
          }
        }
      }
    }

    if (memberSync.default_categories !== undefined) {
      if (!Array.isArray(memberSync.default_categories)) {
        throw new Error('member_sync.default_categories must be an array');
      }

      for (const target of memberSync.default_categories) {
        if (!validCategories.has(target)) {
          throw new Error(
            `member_sync.default_categories refers to unknown category: ${target}`
          );
        }
      }
    }

    // 'default' without any default categories would produce students that fail
    // the "at least one category" rule on every run.
    if (
      memberSync.unmapped_category_action === 'default' &&
      (memberSync.default_categories ?? []).length === 0
    ) {
      throw new Error(
        "member_sync.default_categories must not be empty when unmapped_category_action is 'default'"
      );
    }

    if (memberSync.belt_map !== undefined) {
      if (typeof memberSync.belt_map !== 'object' || Array.isArray(memberSync.belt_map)) {
        throw new Error('member_sync.belt_map must be an object');
      }

      for (const [sourceGrade, target] of Object.entries(memberSync.belt_map)) {
        if (target === null) continue;
        if (typeof target !== 'string' || !validBeltLevels.has(target)) {
          throw new Error(
            `member_sync.belt_map.${sourceGrade} refers to unknown belt level: ${String(target)}`
          );
        }
      }
    }

    if (memberSync.dan_grades !== undefined) {
      if (
        !Array.isArray(memberSync.dan_grades) ||
        memberSync.dan_grades.some((grade: unknown) => typeof grade !== 'string')
      ) {
        throw new Error('member_sync.dan_grades must be an array of grade names');
      }
    }

    if (memberSync.dan_map !== undefined) {
      if (typeof memberSync.dan_map !== 'object' || Array.isArray(memberSync.dan_map)) {
        throw new Error('member_sync.dan_map must be an object');
      }

      for (const [dan, target] of Object.entries(memberSync.dan_map)) {
        if (!/^\d+$/.test(dan)) {
          throw new Error(`member_sync.dan_map keys must be dan numbers, got: ${dan}`);
        }
        if (target === null) continue;
        if (typeof target !== 'string' || !validBeltLevels.has(target)) {
          throw new Error(
            `member_sync.dan_map.${dan} refers to unknown belt level: ${String(target)}`
          );
        }
      }
    }

    // A grade that sources its level from kyuDanGrade is useless without a
    // dan_map to look the number up in.
    if ((memberSync.dan_grades ?? []).length > 0 && Object.keys(memberSync.dan_map ?? {}).length === 0) {
      throw new Error('member_sync.dan_map must not be empty when dan_grades is set');
    }

    if (
      memberSync.deactivate_missing !== undefined &&
      typeof memberSync.deactivate_missing !== 'boolean'
    ) {
      throw new Error('member_sync.deactivate_missing must be a boolean');
    }
  }

  /**
   * Get all categories with metadata
   */
  public getCategories(): CategoryConfig[] {
    this.ensureInitialized();
    return [...this.config.categories];
  }

  /**
   * Get category values only (for validation)
   */
  public getCategoryValues(): string[] {
    this.ensureInitialized();
    return this.config.categories.map(c => c.value);
  }

  /**
   * Get all belt levels with metadata
   */
  public getBeltLevels(): BeltLevelConfig[] {
    this.ensureInitialized();
    return [...this.config.belt_levels];
  }

  /**
   * Get belt level values only (for validation)
   */
  public getBeltLevelValues(): string[] {
    this.ensureInitialized();
    return this.config.belt_levels.map(b => b.value);
  }

  /**
   * Check if a category value is valid
   */
  public isValidCategory(value: string): boolean {
    this.ensureInitialized();
    return this.config.categories.some(c => c.value === value);
  }

  /**
   * Check if a belt level value is valid
   */
  public isValidBeltLevel(value: string): boolean {
    this.ensureInitialized();
    return this.config.belt_levels.some(b => b.value === value);
  }

  /**
   * Get a category by value
   */
  public getCategoryByValue(value: string): CategoryConfig | undefined {
    this.ensureInitialized();
    return this.config.categories.find(c => c.value === value);
  }

  /**
   * Get a belt level by value
   */
  public getBeltLevelByValue(value: string): BeltLevelConfig | undefined {
    this.ensureInitialized();
    return this.config.belt_levels.find(b => b.value === value);
  }

  /**
   * Get the member sync configuration, with defaults applied.
   *
   * Returns a safe no-op configuration when the block is absent so the sync
   * service can run without special-casing an unconfigured installation.
   */
  public getMemberSyncConfig(): MemberSyncConfig {
    this.ensureInitialized();
    const memberSync = this.config.member_sync;

    return {
      category_map: memberSync?.category_map ?? {},
      unmapped_category_action: memberSync?.unmapped_category_action ?? 'report',
      default_categories: memberSync?.default_categories ?? [],
      belt_map: memberSync?.belt_map ?? {},
      dan_grades: memberSync?.dan_grades ?? [],
      dan_map: memberSync?.dan_map ?? {},
      deactivate_missing: memberSync?.deactivate_missing ?? true,
    };
  }

  /**
   * Ensure the config service has been initialized
   */
  private ensureInitialized(): void {
    if (!this.config) {
      throw new Error('ConfigService has not been initialized. Call ConfigService.initialize() first.');
    }
  }
}

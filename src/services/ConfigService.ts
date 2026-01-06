// src/services/ConfigService.ts - Configuration service singleton

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { SystemConfig, CategoryConfig, BeltLevelConfig } from '../types/config';

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

      console.log(`✅ Configuration loaded: ${config.categories.length} categories, ${config.belt_levels.length} belt levels`);
    } catch (error: any) {
      console.error('❌ Failed to load configuration:', error.message);
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
   * Ensure the config service has been initialized
   */
  private ensureInitialized(): void {
    if (!this.config) {
      throw new Error('ConfigService has not been initialized. Call ConfigService.initialize() first.');
    }
  }
}

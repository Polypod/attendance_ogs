export const LEGACY_CATEGORY_VALUES = {
  kids: 'barn',
  youth: 'ungdom',
  adult: 'vuxen',
  advanced: 'avancerad',
} as const;

export function normalizeLegacyCategoryValue(value: string): string {
  return LEGACY_CATEGORY_VALUES[value as keyof typeof LEGACY_CATEGORY_VALUES] ?? value;
}

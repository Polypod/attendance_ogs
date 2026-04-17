export type CsvCellValue = string | number | boolean | null | undefined;

const FORMULA_PREFIX_CHARS = new Set(['=', '+', '-', '@']);

export const sanitizeCsvFormula = (value: string): string => {
  if (value.length === 0) return value;

  const trimmedStart = value.replace(/^\s+/, '');
  if (trimmedStart.length === 0) return value;

  const first = trimmedStart[0];
  if (!FORMULA_PREFIX_CHARS.has(first)) return value;

  if (trimmedStart.startsWith("'")) return value;
  return `'${value}`;
};

export const encodeCsvCell = (value: CsvCellValue): string => {
  if (value === null || value === undefined) return '';

  const stringValue = typeof value === 'string' ? sanitizeCsvFormula(value) : String(value);

  const escaped = stringValue.replace(/"/g, '""');
  const needsQuotes = /[",\r\n]/.test(escaped);

  return needsQuotes ? `"${escaped}"` : escaped;
};

export const encodeCsvRow = (values: CsvCellValue[], delimiter = ','): string => {
  return values.map(encodeCsvCell).join(delimiter);
};

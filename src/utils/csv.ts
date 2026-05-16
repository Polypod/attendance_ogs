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

export const restoreSanitizedCsvFormula = (value: string): string => {
  if (!value.startsWith("'")) return value;

  const restoredValue = value.slice(1);
  const trimmedStart = restoredValue.replace(/^\s+/, '');
  if (trimmedStart.length === 0) return value;

  const first = trimmedStart[0];
  if (!FORMULA_PREFIX_CHARS.has(first)) return value;

  return restoredValue;
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

export const parseCsv = (input: string, delimiter = ','): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let index = 0;
  let insideQuotes = false;

  while (index < input.length) {
    const char = input[index];

    if (char === '"') {
      const nextChar = input[index + 1];
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        index += 2;
        continue;
      }

      insideQuotes = !insideQuotes;
      index += 1;
      continue;
    }

    if (!insideQuotes && char === delimiter) {
      currentRow.push(currentCell);
      currentCell = '';
      index += 1;
      continue;
    }

    if (!insideQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && input[index + 1] === '\n') {
        index += 1;
      }

      currentRow.push(currentCell);
      currentCell = '';

      if (currentRow.some((value) => value.length > 0)) {
        rows.push(currentRow);
      }

      currentRow = [];
      index += 1;
      continue;
    }

    currentCell += char;
    index += 1;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    if (currentRow.some((value) => value.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
};

export const detectCsvDelimiter = (input: string, candidates: string[] = [',', ';']): string => {
  const firstNonEmptyLine = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstNonEmptyLine) {
    return candidates[0] ?? ',';
  }

  let bestDelimiter = candidates[0] ?? ',';
  let bestCount = -1;

  for (const candidate of candidates) {
    const count = firstNonEmptyLine.split(candidate).length - 1;
    if (count > bestCount) {
      bestDelimiter = candidate;
      bestCount = count;
    }
  }

  return bestDelimiter;
};

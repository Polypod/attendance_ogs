import { encodeCsvCell, encodeCsvRow, sanitizeCsvFormula } from '../../utils/csv';

describe('csv utils', () => {
  describe('sanitizeCsvFormula', () => {
    it('prefixes potential formula strings with apostrophe', () => {
      expect(sanitizeCsvFormula('=1+1')).toBe("'=1+1");
      expect(sanitizeCsvFormula('+SUM(A1:A2)')).toBe("'+SUM(A1:A2)");
      expect(sanitizeCsvFormula('-1+2')).toBe("'-1+2");
      expect(sanitizeCsvFormula('@cmd')).toBe("'@cmd");
    });

    it('detects formulas even with leading whitespace', () => {
      expect(sanitizeCsvFormula('  =1+1')).toBe("'  =1+1");
    });

    it('does not modify safe strings', () => {
      expect(sanitizeCsvFormula('hello')).toBe('hello');
      expect(sanitizeCsvFormula('')).toBe('');
      expect(sanitizeCsvFormula('  ')).toBe('  ');
    });

    it('does not double-prefix already escaped values', () => {
      expect(sanitizeCsvFormula("'=1+1")).toBe("'=1+1");
      expect(sanitizeCsvFormula(" ' =1+1")).toBe(" ' =1+1");
    });
  });

  describe('encodeCsvCell', () => {
    it('encodes null/undefined as empty string', () => {
      expect(encodeCsvCell(null)).toBe('');
      expect(encodeCsvCell(undefined)).toBe('');
    });

    it('escapes quotes and wraps when needed', () => {
      expect(encodeCsvCell('a"b')).toBe('"a""b"');
      expect(encodeCsvCell('a,b')).toBe('"a,b"');
      expect(encodeCsvCell('a\nb')).toBe('"a\nb"');
    });

    it('sanitizes formulas before encoding', () => {
      expect(encodeCsvCell('=1+1')).toBe("'=1+1");
    });
  });

  describe('encodeCsvRow', () => {
    it('joins encoded cells with delimiter', () => {
      expect(encodeCsvRow(['a', 'b', 'c'])).toBe('a,b,c');
      expect(encodeCsvRow(['a', 'b,c', 'd'])).toBe('a,"b,c",d');
    });
  });
});

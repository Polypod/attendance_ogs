import { ConfigService } from '../../services/ConfigService';
import { SystemConfig } from '../../types/config';

describe('ConfigService', () => {
  const instance = ConfigService.getInstance() as any;
  const baseConfig: SystemConfig = {
    version: '1.0',
    categories: [
      { value: 'kids', label: 'Kids', description: 'Kids', order: 1 }
    ],
    belt_levels: [
      { value: '10kyu', label: '10 kyu', rank: 1, color: '#fff' },
      { value: '9kyu', label: '9 kyu', rank: 2, color: '#ffd700' }
    ]
  };

  beforeEach(() => {
    instance.config = { ...baseConfig };
  });

  it('returns categories and belt levels', () => {
    expect(instance.getCategories().length).toBe(1);
    expect(instance.getBeltLevels().length).toBe(2);
  });

  it('validates values correctly', () => {
    expect(instance.isValidCategory('kids')).toBe(true);
    expect(instance.isValidCategory('adult')).toBe(false);
    expect(instance.isValidBeltLevel('10kyu')).toBe(true);
    expect(instance.isValidBeltLevel('black')).toBe(false);
  });

  it('gets by value', () => {
    expect(instance.getCategoryByValue('kids')?.label).toBe('Kids');
    expect(instance.getBeltLevelByValue('9kyu')?.rank).toBe(2);
  });

  it('throws if not initialized', () => {
    instance.config = undefined;
    expect(() => instance.getCategories()).toThrow('ConfigService has not been initialized');
  });
});

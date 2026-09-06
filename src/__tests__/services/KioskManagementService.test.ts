import { hashKioskAccessKey } from '../../services/KioskManagementService';

describe('KioskManagementService', () => {
  describe('hashKioskAccessKey', () => {
    it('returns stable sha256 hashes', () => {
      const input = 'test-kiosk-key';
      const first = hashKioskAccessKey(input);
      const second = hashKioskAccessKey(input);

      expect(first).toBe(second);
      expect(first).toMatch(/^[a-f0-9]{64}$/);
      expect(first).not.toBe(input);
    });
  });
});

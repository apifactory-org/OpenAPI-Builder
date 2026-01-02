// tests/unit/domain/services/NameNormalizer.test.js

const { NameNormalizerService } = require('../../../../bin/domain/services/NameNormalizerService');

describe('NameNormalizerService', () => {
  let service;

  beforeEach(() => {
    service = new NameNormalizerService();
  });

  describe('applyConvention', () => {
    test('debería convertir a PascalCase', () => {
      expect(service.applyConvention('user-name', 'PascalCase')).toBe('UserName');
      expect(service.applyConvention('user_name', 'PascalCase')).toBe('UserName');
      expect(service.applyConvention('userName', 'PascalCase')).toBe('UserName');
    });

    test('debería convertir a camelCase', () => {
      expect(service.applyConvention('user-name', 'camelCase')).toBe('userName');
      expect(service.applyConvention('UserName', 'camelCase')).toBe('userName');
    });

    test('debería convertir a kebab-case', () => {
      expect(service.applyConvention('UserName', 'kebab-case')).toBe('user-name');
      expect(service.applyConvention('user_name', 'kebab-case')).toBe('user-name');
    });
  });
});

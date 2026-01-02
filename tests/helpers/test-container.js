// tests/helpers/test-container.js

const { DependencyContainer } = require('../../bin/interface/cli/DependencyContainer');

/**
 * Contenedor de dependencias para tests
 * con configuración optimizada para testing
 */
class TestContainer extends DependencyContainer {
  constructor(testConfig = {}) {
    super();
    this.testConfig = testConfig;
    this.initialize();
  }

  /**
   * Sobrescribe configuración con valores de test
   */
  getConfig() {
    const baseConfig = super.getConfig();
    
    return {
      ...baseConfig,
      ...this.testConfig,
      logging: {
        ...baseConfig.logging,
        level: 'error',
      },
      // ✅ VALIDACIÓN REAL ACTIVADA
      validation: {
        enabled: true,
      },
    };
  }
}

module.exports = { TestContainer };
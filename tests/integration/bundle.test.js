// tests/integration/bundle.test.js

const fs = require('fs');
const path = require('path');
const { TestContainer } = require('../helpers/test-container');
const { OpenAPIAssertions } = require('../helpers/assertions');

describe('Feature: Bundle OpenAPI', () => {
  let container;
  let bundleUseCase;
  let modularizeUseCase;
  const testModularDir = path.join(__dirname, '../output/modular');
  const testBundleDir = path.join(__dirname, '../output/bundle');
  const fixturesDir = path.join(__dirname, '../fixtures/openapi');

  beforeAll(() => {
    container = new TestContainer();
    bundleUseCase = container.getBundleUseCase();
    modularizeUseCase = container.getModularizeUseCase();
  });

  beforeEach(async () => {
    await cleanupTestOutput(fs, path, testModularDir);
    await cleanupTestOutput(fs, path, testBundleDir);
  });

  afterAll(async () => {
    await cleanupTestOutput(fs, path, testModularDir);
    await cleanupTestOutput(fs, path, testBundleDir);
  });

  describe('Casos exitosos', () => {
    test('debería consolidar estructura modular en un solo archivo', async () => {
      // Arrange: Primero modularizar
      const inputPath = path.join(fixturesDir, 'petstore-simple.yaml');
      
      const modularizeConfig = {
        ...container.getConfig(),
        paths: {
          modularizedOutput: testModularDir,
        },
        behavior: {
          cleanModularizedOutput: true,
        },
      };
      
      await modularizeUseCase.execute(
        inputPath,
        modularizeConfig,
        { isInteractive: false }
      );

      // Verificar que se generó
      expect(fs.existsSync(testModularDir)).toBe(true);
      expect(fs.existsSync(path.join(testModularDir, 'main.yaml'))).toBe(true);

      const bundleConfig = {
        bundle: {
          dereference: false,
          removeUnusedComponents: false,
          validate: false,
        },
        behavior: {
          cleanDist: true,
        },
      };

      const entrypoint = path.join(testModularDir, 'main.yaml');
      const outputPath = path.join(testBundleDir, 'bundled.yaml');

      // Act
      await bundleUseCase.execute(entrypoint, outputPath, bundleConfig);

      // Assert
      const parsed = OpenAPIAssertions.assertValidOpenAPIFile(outputPath, [
        'openapi',
        'paths',
        'info'
      ]);
      
      expect(parsed.openapi).toBeDefined();
      expect(parsed.paths).toBeDefined();
    });
  });
});
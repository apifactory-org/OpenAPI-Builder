// tests/integration/modularize.test.js

const fs = require('fs');
const path = require('path');
const { TestContainer } = require('../helpers/test-container');
const { OpenAPIAssertions } = require('../helpers/assertions');

describe('Feature: Modularize OpenAPI', () => {
  let container;
  let useCase;
  const testOutputDir = path.join(__dirname, '../output/modularize');
  const fixturesDir = path.join(__dirname, '../fixtures/openapi');

  beforeAll(() => {
    container = new TestContainer();
    useCase = container.getModularizeUseCase();
  });

  beforeEach(async () => {
    await cleanupTestOutput(fs, path, testOutputDir);
  });

  afterAll(async () => {
    await cleanupTestOutput(fs, path, testOutputDir);
  });

  describe('Casos exitosos', () => {
    test('debería modularizar un OpenAPI simple', async () => {
      const inputPath = path.join(fixturesDir, 'petstore-simple.yaml');
      
      const config = {
        ...container.getConfig(),
        paths: {
          modularizedOutput: testOutputDir,
        },
        behavior: {
          cleanModularizedOutput: true,
        },
      };

      await useCase.execute(inputPath, config, { isInteractive: false });

      OpenAPIAssertions.assertModularStructure(testOutputDir);
    });

    test('debería crear estructura de carpetas correcta', async () => {
      const inputPath = path.join(fixturesDir, 'petstore-full.yaml');
      
      const config = {
        ...container.getConfig(),
        paths: {
          modularizedOutput: testOutputDir,
        },
        behavior: {
          cleanModularizedOutput: true,
        },
      };

      await useCase.execute(inputPath, config, { isInteractive: false });

      const componentsDir = path.join(testOutputDir, 'components');
      expect(fs.existsSync(path.join(componentsDir, 'schemas'))).toBe(true);
      expect(fs.existsSync(path.join(componentsDir, 'responses'))).toBe(true);
      expect(fs.existsSync(path.join(componentsDir, 'parameters'))).toBe(true);
    });

    test('debería modularizar parámetros por tipo', async () => {
      const inputPath = path.join(fixturesDir, 'petstore-full.yaml');
      
      const config = {
        ...container.getConfig(),
        paths: {
          modularizedOutput: testOutputDir,
        },
        behavior: {
          cleanModularizedOutput: true,
        },
      };

      await useCase.execute(inputPath, config, { isInteractive: false });

      const parametersDir = path.join(testOutputDir, 'components/parameters');
      
      if (fs.existsSync(parametersDir)) {
        const subDirs = fs.readdirSync(parametersDir, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name);

        expect(subDirs.length).toBeGreaterThan(0);
      }
    });

    test('debería generar referencias correctas en paths', async () => {
      const inputPath = path.join(fixturesDir, 'petstore-full.yaml');
      
      const config = {
        ...container.getConfig(),
        paths: {
          modularizedOutput: testOutputDir,
        },
        behavior: {
          cleanModularizedOutput: true,
        },
      };

      await useCase.execute(inputPath, config, { isInteractive: false });

      const pathsDir = path.join(testOutputDir, 'paths');
      
      if (fs.existsSync(pathsDir)) {
        const pathFiles = fs.readdirSync(pathsDir);
        expect(pathFiles.length).toBeGreaterThan(0);

        if (pathFiles.length > 0) {
          const samplePathFile = path.join(pathsDir, pathFiles[0]);
          OpenAPIAssertions.assertHasRelativeRefs(samplePathFile);
        }
      }
    });
  });

  describe('Casos de error', () => {
    test('debería fallar con archivo inexistente', async () => {
      const config = {
        ...container.getConfig(),
        paths: {
          modularizedOutput: testOutputDir,
        },
      };

      await expect(
        useCase.execute('./non-existent.yaml', config, { isInteractive: false })
      ).rejects.toThrow('no existe');
    });
  });
});
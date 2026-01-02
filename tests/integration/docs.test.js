// tests/integration/docs.test.js

const fs = require('fs');
const path = require('path');
const { TestContainer } = require('../helpers/test-container');

describe('Feature: Generate Docs', () => {
  let container;
  let useCase;
  const testOutputDir = path.join(__dirname, '../output/docs');
  const fixturesDir = path.join(__dirname, '../fixtures/openapi');

  beforeAll(() => {
    container = new TestContainer();
    useCase = container.getGenerateDocsUseCase();
  });

  beforeEach(async () => {
    await cleanupTestOutput(fs, path, testOutputDir);
  });

  afterAll(async () => {
    await cleanupTestOutput(fs, path, testOutputDir);
  });

  describe('Casos exitosos', () => {
    test('debería generar documentación markdown', async () => {
      const inputPath = path.join(fixturesDir, 'petstore-simple.yaml');
      const outputPath = path.join(testOutputDir, 'api-docs.md');
      
      const config = {
        docs: {
          format: 'markdown',
          theme: 'default',
        },
        behavior: {
          cleanDocs: true,
        },
      };

      await useCase.execute(inputPath, outputPath, config);

      expect(fs.existsSync(outputPath)).toBe(true);
      
      const content = fs.readFileSync(outputPath, 'utf8');
      expect(content).toContain('# '); // Markdown headers
    });
  });
});

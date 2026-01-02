// tests/integration/downgrade.test.js

const fs = require('fs');
const path = require('path');
const { TestContainer } = require('../helpers/test-container');
const { OpenAPIAssertions } = require('../helpers/assertions');

describe('Feature: Downgrade to Swagger 2.0', () => {
  let container;
  let useCase;
  const testOutputDir = path.join(__dirname, '../output/swagger2');
  const fixturesDir = path.join(__dirname, '../fixtures/openapi');

  beforeAll(() => {
    container = new TestContainer();
    useCase = container.getDowngradeSwagger2UseCase();
  });

  beforeEach(async () => {
    await cleanupTestOutput(fs, path, testOutputDir);
  });

  afterAll(async () => {
    await cleanupTestOutput(fs, path, testOutputDir);
  });

  describe('Casos exitosos', () => {
    test('debería convertir OpenAPI 3.x a Swagger 2.0', async () => {
      const inputPath = path.join(fixturesDir, 'petstore-simple.yaml');
      const outputPath = path.join(testOutputDir, 'swagger2.yaml');
      
      const config = {
        downgrade: {
          validate: false,
        },
        behavior: {
          cleanOutput: true,
        },
      };

      await useCase.execute(inputPath, outputPath, config);

      const parsed = OpenAPIAssertions.assertValidOpenAPIFile(outputPath, [
        'swagger',
        'paths',
        'info'
      ]);
      
      expect(parsed.swagger).toBe('2.0');
    });
  });
});

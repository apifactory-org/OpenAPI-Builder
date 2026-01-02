// tests/integration/idempotence.test.js

const fs = require('fs');
const path = require('path');
const { TestContainer } = require('../helpers/test-container');

async function cleanupTestOutput(fs, path, dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('Feature: Idempotencia (Re-modularizar)', () => {
  let container;
  let modularizeUseCase;
  let bundleUseCase;
  
  const testModularDir = path.join(__dirname, '../output/idempotence/modular');
  const testBundleDir = path.join(__dirname, '../output/idempotence/bundle');
  const testRemodularDir = path.join(__dirname, '../output/idempotence/remodular');
  const fixturesDir = path.join(__dirname, '../fixtures/openapi');

  beforeAll(() => {
    container = new TestContainer();
    modularizeUseCase = container.getModularizeUseCase();
    bundleUseCase = container.getBundleUseCase();
  });

  beforeEach(async () => {
    await cleanupTestOutput(fs, path, testModularDir);
    await cleanupTestOutput(fs, path, testBundleDir);
    await cleanupTestOutput(fs, path, testRemodularDir);
  });

  afterAll(async () => {
    await cleanupTestOutput(fs, path, testModularDir);
    await cleanupTestOutput(fs, path, testBundleDir);
    await cleanupTestOutput(fs, path, testRemodularDir);
  });

  test('debería poder re-modularizar un bundle sin duplicar sufijos', async () => {
    // PASO 1: Modularizar (copiado exacto de bundle.test.js)
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
    
    const schemas1 = fs.readdirSync(path.join(testModularDir, 'components/schemas'));
    expect(schemas1.length).toBeGreaterThan(0);
    
    // PASO 2: Bundle (copiado exacto de bundle.test.js)
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

    await bundleUseCase.execute(entrypoint, outputPath, bundleConfig);

    // Verificar bundle
    expect(fs.existsSync(outputPath)).toBe(true);
    
    // PASO 3: Re-modularizar el bundle
    const remodularConfig = {
      ...container.getConfig(),
      paths: {
        modularizedOutput: testRemodularDir,
      },
      behavior: {
        cleanModularizedOutput: true,
      },
    };
    
    await modularizeUseCase.execute(
      outputPath,
      remodularConfig,
      { isInteractive: false }
    );

    // Verificar re-modularización
    expect(fs.existsSync(testRemodularDir)).toBe(true);
    expect(fs.existsSync(path.join(testRemodularDir, 'main.yaml'))).toBe(true);
    
    const schemas2 = fs.readdirSync(path.join(testRemodularDir, 'components/schemas'));
    expect(schemas2.length).toBeGreaterThan(0);
    
    // VERIFICAR: NO dobles sufijos
    const hasDoubleSuffix = schemas2.some(file => 
      file.includes('SchemaSchema') || 
      file.includes('ResponseResponse') ||
      file.includes('RequestRequest') ||
      file.includes('ParamParam')
    );
    
    expect(hasDoubleSuffix).toBe(false);
    
    // VERIFICAR: Idempotencia (mismos nombres)
    expect(schemas2.sort()).toEqual(schemas1.sort());
  });

  test('debería detectar sufijos existentes en componentes', async () => {
    const inputPath = path.join(fixturesDir, 'petstore-simple.yaml');
    
    const config = {
      ...container.getConfig(),
      paths: {
        modularizedOutput: testModularDir,
      },
      behavior: {
        cleanModularizedOutput: true,
      },
    };
    
    await modularizeUseCase.execute(inputPath, config, { isInteractive: false });

    expect(fs.existsSync(testModularDir)).toBe(true);
    expect(fs.existsSync(path.join(testModularDir, 'main.yaml'))).toBe(true);
    
    const componentsDir = path.join(testModularDir, 'components');
    
    const getAllFiles = (dir) => {
      const files = [];
      if (!fs.existsSync(dir)) return files;
      
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory()) {
          files.push(...getAllFiles(path.join(dir, item.name)));
        } else {
          files.push(item.name);
        }
      }
      return files;
    };
    
    const allFiles = getAllFiles(componentsDir);
    const hasDoubleSuffix = allFiles.some(file => 
      file.includes('SchemaSchema') ||
      file.includes('ResponseResponse') ||
      file.includes('RequestRequest') ||
      file.includes('ParamParam')
    );
    
    expect(hasDoubleSuffix).toBe(false);
  });
});
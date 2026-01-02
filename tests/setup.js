// tests/setup.js

// Configuración global de Jest
jest.setTimeout(30000); // 30 segundos para tests de integración

// Mock de console para tests más limpios
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Helper global para limpieza
global.cleanupTestOutput = async (fs, path, dirPath) => {
  if (fs.existsSync(dirPath)) {
    await fs.promises.rm(dirPath, { recursive: true, force: true });
  }
};

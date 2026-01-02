# Tests

Estructura de tests del proyecto OpenAPI Builder.

## Estructura

```
tests/
├── fixtures/          # Datos de ejemplo para tests
├── integration/       # Tests E2E de features completos
├── unit/             # Tests unitarios de componentes
├── helpers/          # Utilidades reutilizables
└── output/           # Salida temporal de tests (gitignored)
```

## Ejecutar Tests

```bash
# Todos los tests
npm test

# Solo integration
npm run test:integration

# Solo unit
npm run test:unit

# Con coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Agregar Nuevos Tests

1. Para features completos → `integration/`
2. Para funciones específicas → `unit/`
3. Nuevos datos de prueba → `fixtures/`

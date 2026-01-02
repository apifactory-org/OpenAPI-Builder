# Guía de Contribución

¡Gracias por tu interés en contribuir a **OpenAPI Builder**! Este documento te guiará en el proceso.

## 🎯 Código de Conducta

- Sé respetuoso y constructivo en las discusiones
- Acepta críticas constructivas
- Enfócate en lo mejor para el proyecto y la comunidad
- Reporta comportamientos inapropiados a los maintainers

## 🚀 Formas de Contribuir

### 1. Reportar Bugs

Usa el [issue tracker](https://github.com/tu-usuario/openapi-builder/issues) con:

- **Título descriptivo**
- **Pasos para reproducir** el bug
- **Comportamiento esperado** vs **actual**
- **Versión** de Node.js y OpenAPI Builder
- **Archivos de ejemplo** (si es posible)

Plantilla:

```markdown
## Descripción del Bug
[Descripción clara y concisa]

## Pasos para Reproducir
1. Ejecutar `openapi-builder modularize --build api.yaml`
2. Ver error en...

## Comportamiento Esperado
[Lo que debería pasar]

## Comportamiento Actual
[Lo que realmente pasa]

## Entorno
- OS: [e.g. Windows 11]
- Node: [e.g. v16.14.0]
- OpenAPI Builder: [e.g. v1.0.1]

## Archivos de Ejemplo
[Adjuntar o enlazar]
```

### 2. Sugerir Features

Abre un issue con:

- **Problema** que resuelve
- **Solución propuesta**
- **Alternativas** consideradas
- **Contexto adicional**

### 3. Contribuir Código

¡Las Pull Requests son bienvenidas! Sigue estos pasos:

## 🔧 Configuración del Entorno

### Prerrequisitos

- Node.js >= 16
- npm >= 8
- Git

### Setup

```bash
# 1. Fork el repositorio en GitHub
# 2. Clonar tu fork
git clone https://github.com/tu-usuario/openapi-builder.git
cd openapi-builder

# 3. Instalar dependencias
npm install

# 4. Crear una rama para tu feature/fix
git checkout -b feature/mi-feature
# o
git checkout -b fix/mi-bugfix

# 5. Hacer tus cambios
# ...

# 6. Ejecutar tests
npm test

# 7. Verificar arquitectura
npm run validate:arch

# 8. Commit siguiendo convenciones
git commit -m "feat: agregar nueva funcionalidad"

# 9. Push a tu fork
git push origin feature/mi-feature

# 10. Abrir Pull Request en GitHub
```

## 📐 Principios Arquitectónicos

### Regla de Oro: Respeta Clean Architecture

```
❌ NUNCA: domain importa infrastructure
✅ SIEMPRE: domain es independiente
```

Verificar con:

```bash
npm run validate:arch
```

### Estructura de Capas

```
interface → application → domain ← infrastructure
```

- **Domain**: Lógica de negocio pura, sin dependencias externas
- **Application**: Casos de uso, orquesta domain
- **Infrastructure**: Implementaciones concretas (adapters)
- **Interface**: CLI, presentación

### Añadir Nueva Funcionalidad

#### 1. Crear Entity o Service en Domain

```javascript
// bin/domain/entities/MiEntity.js
class MiEntity {
  constructor(data) {
    this.data = data;
  }
  
  // Lógica de negocio pura
  validate() {
    // ...
  }
}

module.exports = MiEntity;
```

#### 2. Definir Port en Application

```javascript
// bin/application/ports/IMiService.js
class IMiService {
  async execute(params) {
    throw new Error('Must implement execute');
  }
}

module.exports = IMiService;
```

#### 3. Crear Use Case

```javascript
// bin/application/use-cases/MiUseCase.js
class MiUseCase {
  constructor(miService, logger) {
    this.miService = miService;
    this.logger = logger;
  }
  
  async execute(params) {
    this.logger.info('Executing MiUseCase');
    return await this.miService.execute(params);
  }
}

module.exports = MiUseCase;
```

#### 4. Implementar Adapter en Infrastructure

```javascript
// bin/infrastructure/adapters/MiServiceAdapter.js
const IMiService = require('../../application/ports/IMiService');

class MiServiceAdapter extends IMiService {
  async execute(params) {
    // Implementación concreta usando biblioteca externa
    return result;
  }
}

module.exports = MiServiceAdapter;
```

#### 5. Registrar en DependencyContainer

```javascript
// bin/interface/cli/DependencyContainer.js
const MiServiceAdapter = require('../../infrastructure/adapters/MiServiceAdapter');
const MiUseCase = require('../../application/use-cases/MiUseCase');

class DependencyContainer {
  static createMiUseCase() {
    const service = new MiServiceAdapter();
    return new MiUseCase(service, logger);
  }
}
```

#### 6. Agregar Comando CLI

```javascript
// bin/interface/cli/cli.js
program
  .command('mi-comando')
  .description('Descripción del comando')
  .option('-i, --input <file>', 'Archivo de entrada')
  .action(async (options) => {
    const useCase = DependencyContainer.createMiUseCase();
    await useCase.execute(options);
  });
```

## 🧪 Testing

### Ejecutar Tests

```bash
# Todos los tests
npm test

# Tests unitarios
npm run test:unit

# Tests de integración
npm run test:integration

# Con coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Estructura de Tests

```
tests/
├── unit/                   # Tests unitarios
│   ├── domain/
│   ├── application/
│   └── infrastructure/
├── integration/            # Tests de integración
│   └── commands/
└── fixtures/               # Datos de prueba
    └── openapi-examples/
```

### Escribir Tests

#### Test Unitario (Domain)

```javascript
// tests/unit/domain/services/NameNormalizer.test.js
const NameNormalizerService = require('../../../../bin/domain/services/NameNormalizerService');

describe('NameNormalizerService', () => {
  it('should normalize response name', () => {
    const service = new NameNormalizerService();
    const result = service.normalize('200 OK Response');
    expect(result).toBe('OkResponse');
  });
});
```

#### Test de Integración (Use Case)

```javascript
// tests/integration/commands/modularize.test.js
const ModularizeUseCase = require('../../../bin/application/use-cases/ModularizeUseCase');

describe('ModularizeUseCase Integration', () => {
  it('should modularize OpenAPI file', async () => {
    const useCase = createUseCase(); // Con mocks
    const result = await useCase.execute({ build: './fixtures/api.yaml' });
    expect(result.success).toBe(true);
  });
});
```

### Coverage Mínimo

```json
{
  "branches": 50,
  "functions": 50,
  "lines": 50,
  "statements": 50
}
```

## 📝 Estilo de Código

### Convenciones

- **Indentación**: 2 espacios
- **Comillas**: Simples `'string'`
- **Semicolons**: Requeridos
- **Naming**:
  - Classes: `PascalCase`
  - Functions/methods: `camelCase`
  - Constants: `UPPER_SNAKE_CASE`
  - Files: `PascalCase.js`

### Ejemplos

```javascript
// ✅ Correcto
class MyService {
  async execute(params) {
    const result = await this.process(params);
    return result;
  }
}

// ❌ Incorrecto
class my_service {
  async Execute(Params) {
    let Result = await this.Process(Params)
    return Result
  }
}
```

### JSDoc

Documenta funciones públicas:

```javascript
/**
 * Normaliza el nombre de una response
 * @param {string} name - Nombre original de la response
 * @returns {string} Nombre normalizado
 */
normalize(name) {
  // ...
}
```

## 🔄 Proceso de Pull Request

### 1. Antes de Abrir PR

- [ ] Tests pasan: `npm test`
- [ ] Arquitectura válida: `npm run validate:arch`
- [ ] Coverage adecuado
- [ ] Código documentado
- [ ] CHANGELOG actualizado (si aplica)

### 2. Título del PR

Usa [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: agregar comando validate
fix: corregir bug en reference fixer
docs: actualizar README
refactor: simplificar ModularizeUseCase
test: agregar tests para BundleUseCase
```

### 3. Descripción del PR

Usa esta plantilla:

```markdown
## Descripción
[Descripción clara del cambio]

## Tipo de Cambio
- [ ] Bug fix (non-breaking)
- [ ] New feature (non-breaking)
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests unitarios agregados/actualizados
- [ ] Tests de integración agregados/actualizados
- [ ] Tests manuales realizados

## Checklist
- [ ] Mi código sigue el estilo del proyecto
- [ ] He realizado self-review
- [ ] He comentado código complejo
- [ ] He actualizado la documentación
- [ ] Mis cambios no generan warnings
- [ ] He agregado tests
- [ ] Tests pasan localmente
- [ ] Validación de arquitectura pasa
```

### 4. Proceso de Review

1. **Automated checks**: CI debe pasar
2. **Code review**: Al menos 1 approval de maintainer
3. **Discusión**: Responde a comentarios
4. **Updates**: Haz cambios solicitados
5. **Merge**: Maintainer hace merge

## 🐛 Debugging

### Modo Verbose

```bash
openapi-builder modularize --build api.yaml --verbose
```

### Logs Detallados

Edita `config/logging.yaml`:

```yaml
level: debug  # o trace
```

### VS Code Debug

`.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Modularize",
      "program": "${workspaceFolder}/bin/main.js",
      "args": ["modularize", "--build", "./fixtures/api.yaml"],
      "console": "integratedTerminal"
    }
  ]
}
```

## 📦 Commits Semánticos

Usa prefijos estándar:

- `feat:` Nueva funcionalidad
- `fix:` Bug fix
- `docs:` Cambios en documentación
- `style:` Formato, semicolons, etc.
- `refactor:` Refactorización sin cambio funcional
- `perf:` Mejoras de performance
- `test:` Agregar/modificar tests
- `chore:` Mantenimiento, deps, etc.
- `ci:` Cambios en CI/CD

Ejemplos:

```bash
git commit -m "feat: add validation for bundle command"
git commit -m "fix: resolve circular reference in ReferenceResolver"
git commit -m "docs: update architecture diagram"
```

## 🔍 Recursos Adicionales

- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [OpenAPI 3.0 Spec](https://spec.openapis.org/oas/v3.0.0)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)

## 💬 Comunicación

- **Issues**: Para bugs y feature requests
- **Discussions**: Para preguntas y discusiones generales
- **Email**: Para temas sensibles o privados

## 🙏 Reconocimiento

Los contribuidores serán reconocidos en:

- `CONTRIBUTORS.md`
- Release notes
- Documentación del proyecto

¡Gracias por contribuir a OpenAPI Builder! 🎉
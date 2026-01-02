# AI Context Pack — OpenAPI Builder

Este documento proporciona contexto estructurado para herramientas de IA y asistentes que interactúan con el proyecto **OpenAPI Builder**.

Generated: 2026-01-02
Repository: `@apifactory/openapi-builder`
Type: Node.js CLI

## 🎯 Propósito Autoritativo

Este repositorio implementa un CLI orientado a "API contract operations": convertir una especificación OpenAPI 3.x monolítica en estructura modular mantenible, consolidar a bundle validado, generar documentación y exportar a Swagger 2.0 para compatibilidad legacy.

## 📦 Resumen del Producto

**Nombre**: OpenAPI Builder

**Tipo**: Node.js CLI (Command Line Interface)

**Propósito**: CLI para modularizar contratos OpenAPI 3.x, generar bundle, documentación Markdown y convertir a Swagger 2.0, siguiendo Clean Architecture (capas, puertos/adaptadores).

**Audiencia**:
- Equipos de APIs
- Platform Engineering
- Backend Engineers

## 🔄 Modelo Operacional

### Inputs Declarados

1. **openapi_spec** (file)
   - Formatos: `yaml`, `yml`, `json`
   - Requerido: Sí
   - Usado por: `modularize`
   - Ejemplo: `./api/openapi.yaml`

2. **modular_entrypoint** (file)
   - Formatos: `yaml`, `yml`
   - Requerido: No
   - Default: `./src/main.yaml`
   - Usado por: `bundle`

3. **bundle_input** (file)
   - Formatos: `yaml`, `yml`
   - Requerido: No
   - Default: `./dist/bundle.yaml`
   - Usado por: `docs`, `swagger2`

4. **configs** (folder)
   - Requerido: No
   - Archivos:
     - `./config/modularize.yaml`
     - `./config/bundle.yaml`
     - `./config/swagger2.yaml`
     - `./config/logging.yaml`

### Outputs Garantizados

1. **./src/** - Estructura modular generada desde OpenAPI monolítico
   - Garantizado después de éxito: ✅
   - Idempotente: Sí (si clean output enabled)
   - Debe existir antes: No

2. **./dist/bundle.yaml** - Bundle OpenAPI 3 consolidado
   - Garantizado después de éxito: ✅
   - Idempotente: Sí
   - Debe existir antes: No

3. **./docs/api.md** - Documentación Markdown generada
   - Garantizado después de éxito: ✅
   - Idempotente: Sí
   - Debe existir antes: No

4. **./dist/swagger2.yaml** - Conversión a Swagger 2.0
   - Garantizado después de éxito: ✅
   - Idempotente: Sí
   - Debe existir antes: No

### Invariantes del Sistema

1. **No modifica el OpenAPI original de entrada**; toda salida va a `./src`, `./dist`, `./docs`
2. **Paths relativos se resuelven contra el cwd** (directorio donde se ejecuta el CLI)
3. **Arquitectura**: Domain no debe importar Infrastructure; Interface orquesta Use Cases

## 🎬 Narrativa de Ejecución

### Comando: modularize

```
1. CLI parsea flags y resuelve paths relativos al cwd
2. ModularizeUseCase valida el input OpenAPI 3.x
3. Domain services procesan:
   - Normalizar nombres de responses
   - Extraer responses inline
   - Deduplicar responses similares
   - Extraer parámetros comunes
   - Dividir componentes por tipo
   - Dividir paths por tag/recurso
   - Corregir referencias $ref
4. Escribe estructura modular bajo ./src/
   - main.yaml (entrypoint)
   - components/ (schemas, responses, parameters)
   - paths/ (operaciones agrupadas)
```

### Comando: bundle

```
1. CLI parsea: -i ./src/main.yaml -o ./dist/bundle.yaml
2. BundleUseCase ejecuta:
   - Toma entrypoint modular (default ./src/main.yaml)
   - Consolida todos los archivos referenciados
   - Opcionalmente: remove unused components, validate, no anchors
3. Escribe bundle único en ./dist/bundle.yaml
```

### Comando: docs

```
1. CLI parsea: -i ./dist/bundle.yaml -o ./docs/api.md
2. GenerateDocsUseCase ejecuta:
   - Lee bundle OpenAPI (default ./dist/bundle.yaml)
   - Genera documentación Markdown usando Widdershins
3. Escribe en ./docs/api.md
```

### Comando: swagger2

```
1. CLI parsea: -i ./dist/bundle.yaml -o ./dist/swagger2.yaml
2. DowngradeSwagger2UseCase ejecuta:
   - Lee bundle OpenAPI 3.x
   - Convierte a Swagger 2.0 usando api-spec-converter
   - Aplica patches de compatibilidad
3. Escribe en ./dist/swagger2.yaml
```

## ⚙️ Operaciones / Comandos

### 1. modularize

**Resumen**: Divide un OpenAPI monolítico en estructura modular con corrección de referencias y deduplicación.

**Inputs**:
- `--build <file>`: Archivo OpenAPI monolítico (yaml/json) [REQUERIDO]

**Outputs**:
- `./src/`: Estructura modular completa

**Ejemplo**:
```bash
openapi-builder modularize --build ./api/openapi.yaml
```

### 2. bundle

**Resumen**: Consolida estructura modular en bundle OpenAPI 3 (opcionalmente remove-unused, validate, no-anchors).

**Inputs**:
- `-i/--input <file>`: Entrypoint modular (default: `./src/main.yaml`)
- `-o/--output <file>`: Ruta del bundle (default: `./dist/bundle.yaml`)

**Outputs**:
- `./dist/bundle.yaml`: Bundle consolidado

**Ejemplo**:
```bash
openapi-builder bundle -i ./src/main.yaml -o ./dist/bundle.yaml
```

### 3. docs

**Resumen**: Genera documentación Markdown desde el bundle.

**Inputs**:
- `-i/--input <file>`: Bundle OpenAPI (default: `./dist/bundle.yaml`)
- `-o/--output <file>`: Ruta Markdown (default: `./docs/api.md`)

**Outputs**:
- `./docs/api.md`: Documentación Markdown

**Ejemplo**:
```bash
openapi-builder docs -i ./dist/bundle.yaml -o ./docs/api.md
```

### 4. swagger2

**Resumen**: Convierte OpenAPI 3.x a Swagger 2.0.

**Inputs**:
- `-i/--input <file>`: Bundle OpenAPI 3 (default: `./dist/bundle.yaml`)
- `-o/--output <file>`: Ruta Swagger 2 (default: `./dist/swagger2.yaml`)

**Outputs**:
- `./dist/swagger2.yaml`: Especificación Swagger 2.0

**Ejemplo**:
```bash
openapi-builder swagger2 -i ./dist/bundle.yaml -o ./dist/swagger2.yaml
```

## 🏗️ Mapa Arquitectónico (Hexagonal)

### Capas

| Capa | Path | Descripción |
|------|------|-------------|
| **Interface** | `bin/interface/` | CLI, menús, presenters |
| **Application** | `bin/application/` | Use cases, ports |
| **Domain** | `bin/domain/` | Entities, services, value objects |
| **Infrastructure** | `bin/infrastructure/` | Adapters (Redocly, Widdershins) |

### Puertos y Adaptadores

**Ports** (Interfaces): `bin/application/ports/`
- `IBundler.js`
- `IDocGenerator.js`
- `IDocumentRepository.js`
- `IValidator.js`
- `ILogger.js`
- `IPrompter.js`

**Adapters** (Implementaciones): `bin/infrastructure/adapters/`
- `RedoclyBundler.js` → `IBundler`
- `WiddershinsDocGenerator.js` → `IDocGenerator`
- `YamlDocumentRepository.js` → `IDocumentRepository`
- `RedoclyValidator.js` → `IValidator`
- `ApiSpecConverterDowngrader.js` → Conversión a Swagger 2.0

## 📂 Inventario Estructural

### Interface Layer
```
bin/interface/
├── cli/
│   ├── cli.js                    # Entry point CLI
│   ├── CommandFactory.js         # Command factory
│   └── DependencyContainer.js    # DI container
├── menu/                         # Interactive menus
└── presenters/                   # Output formatters
```

### Application Layer
```
bin/application/
├── ports/                        # Port interfaces
│   ├── IBundler.js
│   ├── IDocGenerator.js
│   ├── IDocumentRepository.js
│   ├── ILogger.js
│   ├── IPrompter.js
│   └── IValidator.js
└── use-cases/                    # Use case orchestrators
    ├── BundleUseCase.js
    ├── DowngradeSwagger2UseCase.js
    ├── GenerateDocsUseCase.js
    └── ModularizeUseCase.js
```

### Domain Layer
```
bin/domain/
├── entities/                     # Domain entities
│   ├── Component.js
│   ├── ComponentFile.js
│   ├── ModularizationModel.js
│   ├── OpenAPIDocument.js
│   └── PathFile.js
├── services/                     # Domain services
│   ├── ComponentSplitterService.js
│   ├── ModelValidator.js
│   ├── ModularizationModelBuilder.js
│   ├── NameNormalizerService.js
│   ├── ParameterExtractorService.js
│   ├── ReferenceFixerService.js
│   ├── ReferenceResolver.js
│   ├── ResponseDeduplicatorService.js
│   └── ResponseExtractorService.js
└── value-objects/                # Value objects
    ├── FilePath.js
    └── StatusCode.js
```

### Infrastructure Layer
```
bin/infrastructure/
├── adapters/                     # Port implementations
│   ├── ApiSpecConverterDowngrader.js
│   ├── InquirerPrompter.js
│   ├── ModularizationWriter.js
│   ├── RedoclyBundler.js
│   ├── RedoclyValidator.js
│   ├── WiddershinsDocGenerator.js
│   └── YamlDocumentRepository.js
├── config/                       # Configuration management
├── logging/                      # Logging infrastructure
└── utils/                        # Utilities
```

## 🤝 Contrato con IA

### Assumptions (Asunciones)

1. CLI ejecutado en Node.js >= 16
2. Herramientas externas (Redocly, Widdershins) se usan vía dependencias npm
3. Inputs son especificaciones OpenAPI 3.0 válidas (no 3.1)

### Non-Goals (No Objetivos)

1. **NO** modificar el OpenAPI original de entrada
2. **NO** soportar OpenAPI 3.1 aún (solo 3.0)
3. **NO** ejecutar validaciones en tiempo real durante edición

### Constraints (Restricciones)

1. **Domain layer MUST NOT import Infrastructure layer** (validado con dependency-cruiser)
2. **CLI flags son la API pública primaria**; evitar breaking changes
3. Paths relativos siempre se resuelven contra cwd

### Known Ambiguities (Ambigüedades Conocidas)

1. Extracción de comandos desde código puede ser heurística si no está declarada en manifest.yml
2. El manifest puede quedar desincronizado si se agregan flags sin actualizarlo
3. Normalización de nombres puede variar según configuración y estilo del OpenAPI original

## 🧩 Modelo de Negocio

**Problema**: Especificaciones OpenAPI monolíticas son difíciles de mantener, generan conflictos en Git, y carecen de reutilización.

**Solución**: Modularización automática que:
- Divide specs grandes en archivos pequeños y organizados
- Deduplica componentes y responses
- Facilita colaboración y code reviews
- Automatiza generación de bundle y documentación

**Valor para Equipos**:
- Reduce fricción de mantenimiento
- Previene conflictos Git en specs monolíticas
- Automatiza outputs de entrega (bundle, docs, swagger2)
- Mejora organización y descubribilidad de APIs

## 🔍 Quality Gates

### knip
**Status**: ❌ Fail
**Reason**: Redundant entry pattern en `knip.json`

### dependency-cruiser
**Status**: ✅ Pass
**Reason**: Architecture boundary check passed (domain no importa infrastructure)

## 📊 Dependencias Principales

### Dependencies (Runtime)
- `@redocly/cli@1.19.0` - Bundling y validación de OpenAPI
- `api-spec-converter@2.12.0` - Conversión a Swagger 2.0
- `chalk@^4.1.2` - Colorización de CLI
- `commander@12.1.0` - CLI framework
- `inquirer@8.2.6` - Prompts interactivos
- `widdershins@4.0.1` - Generación de docs Markdown

### Dev Dependencies
- `jest@^30.2.0` - Testing framework
- `dependency-cruiser@^17.3.5` - Validación de arquitectura
- `knip@^5.77.1` - Dead code detection
- `js-yaml@^4.1.1` - YAML parsing

## 🎓 Guías para IA

### Al Sugerir Cambios

1. **Respetar Clean Architecture**: Domain no puede importar Infrastructure
2. **Mantener compatibilidad de CLI**: No cambiar flags sin deprecation
3. **Seguir estructura de capas**: Nuevas features siguen el patrón port/adapter
4. **Actualizar manifest.yml**: Si agregas comandos o flags
5. **Tests requeridos**: Agregar unit + integration tests

### Al Generar Código

```javascript
// ✅ CORRECTO: Domain service puro
class NameNormalizerService {
  normalize(name) {
    return name.replace(/[^a-zA-Z0-9]/g, '');
  }
}

// ❌ INCORRECTO: Domain importando infrastructure
const fs = require('fs'); // ❌ NO en domain
class NameNormalizerService {
  normalize(name) {
    fs.writeFileSync('log.txt', name); // ❌
    return name.replace(/[^a-zA-Z0-9]/g, '');
  }
}
```

### Al Explicar Arquitectura

Usar analogía de capas:
- **Domain** = Reglas de negocio (qué hacer)
- **Application** = Casos de uso (cómo orquestar)
- **Infrastructure** = Detalles técnicos (con qué herramientas)
- **Interface** = Punto de entrada (cómo interactúa el usuario)

## 🔗 Referencias Útiles

- **OpenAPI 3.0 Spec**: https://spec.openapis.org/oas/v3.0.0
- **Clean Architecture**: https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html
- **Redocly CLI**: https://redocly.com/docs/cli/
- **Widdershins**: https://github.com/Mermade/widdershins

## 📝 Notas de Implementación

### Decisiones de Diseño

1. **YAML como formato primario**: Más legible que JSON para specs modulares
2. **Redocly para bundling**: Mejor manejo de $ref que otras herramientas
3. **Widdershins para docs**: Genera Markdown compatible con GitHub/GitLab
4. **api-spec-converter para Swagger 2.0**: Única librería confiable para downgrade

### Patrones Comunes

1. **Value Objects para paths**: Inmutabilidad garantizada
2. **Services sin estado**: Permiten testing sin setup complejo
3. **Builder pattern**: Para ModularizationModel complejo
4. **Strategy pattern**: Para diferentes estrategias de splitting

---

**Última actualización**: 2026-01-02
**Versión del schema**: 1.1
**Generator**: `scripts/ai-context.js`
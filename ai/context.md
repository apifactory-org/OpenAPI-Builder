# AI Context Pack — OpenAPI Builder

Generated: 2026-01-03T05:06:53.711Z
Repo root: C:\data\@apifactory\oas3-modularize
Product type: node-cli
Version: 1.0.1

## 1) Authoritative Intent [DECLARED]
Este repo implementa un CLI orientado a “API contract operations”: convertir una spec OpenAPI 3.x monolítica en estructura modular mantenible, consolidar a bundle validado, generar documentación y exportar a Swagger 2.0 para compatibilidad legacy.


## 2) Product summary [DECLARED]
**Name:** OpenAPI Builder
**Purpose:** CLI para modularizar contratos OpenAPI 3.x, generar bundle, docs Markdown y convertir a Swagger 2.0, siguiendo Clean Architecture (capas, puertos/adaptadores).

**Binary:** `openapi-builder`

## 3) Operational Model [DECLARED]
**Inputs (declared):**
- openapi_spec (file)
- modular_entrypoint (file)
- bundle_input (file)
- configs (folder)

**Invariants:**
- No modifica el OpenAPI original de entrada; toda salida va a ./src ./dist ./docs.
- Paths relativos se resuelven contra el cwd (directorio donde se ejecuta el CLI).
- Arquitectura: domain no debe importar infrastructure; interface orquesta use-cases.

## 4) Execution Narrative [INFERRED]
When running openapi-builder modularize:
- CLI parses flags and resolves cwd-relative paths.
- Modularize use-case validates the input OpenAPI 3.x.
- Domain services normalize response names, extract inline responses, deduplicate, split components and paths.
- Writes a modular structure under ./src (main.yaml + components/ + paths/), fixing $ref as needed.

When running openapi-builder bundle:
- Takes modular entrypoint (default ./src/main.yaml).
- Bundles into a single OpenAPI file (default ./dist/bundle.yaml), optionally removing unused components and validating.

When running openapi-builder docs:
- Uses the bundle as input (default ./dist/bundle.yaml) and generates Markdown docs (default ./docs/api.md).

When running openapi-builder swagger2:
- Converts bundle OpenAPI 3.x to Swagger 2.0 output (default ./dist/swagger2.yaml).

## 5) Operations / Commands
- `modularize`
- `bundle`
- `docs`
- `swagger2`

## 6) Available npm scripts
- `npm run modularize`
- `npm run bundle`
- `npm run docs`
- `npm run swagger2`
- `npm run test`
- `npm run test:watch`
- `npm run test:coverage`
- `npm run test:integration`
- `npm run test:unit`
- `npm run test:ci`

## 7) Dependencies
### Runtime Dependencies
  - @redocly/cli@1.19.0
  - api-spec-converter@2.12.0
  - chalk@^4.1.2
  - commander@12.1.0
  - inquirer@8.2.6
  - prompts@^2.4.2
  - widdershins@4.0.1

### Development Dependencies
  - @types/jest@^30.0.0
  - dependency-cruiser@^17.3.5
  - jest@^30.2.0
  - js-yaml@^4.1.1
  - knip@^5.77.1
  - madge@^8.0.0

## 8) Inputs / Outputs
### Inputs
| kind | path | required | exists |
|---|---|---|---|
| config | `./config/modularize.yaml` | no | ✓ |
| config | `./config/bundle.yaml` | no | ✓ |
| config | `./config/swagger2.yaml` | no | ✓ |
| config | `./config/logging.yaml` | no | ✓ |
| manifest | `./ai/manifest.yml` | no | ✓ |
| openapi_spec | `(varies: --build)` | yes | — |

### Outputs
| path | description | guaranteed_after_success | exists |
|---|---|---|---|
| `./src` | Estructura modular generada desde un OpenAPI monolítico | true | ✓ |
| `./dist/bundle.yaml` | Bundle OpenAPI 3 consolidado | true | ✗ |
| `./docs/api.md` | Documentación Markdown generada | true | ✗ |
| `./dist/swagger2.yaml` | Conversión a Swagger 2.0 | true | ✗ |

*Note: Outputs marked with ✗ may not exist yet — they are created when running the respective commands.*

## 9) Architecture map (hexagonal) [MEASURED]
- interface: `bin/interface`
- application: `bin/application`
- domain: `bin/domain`
- infrastructure: `bin/infrastructure`
- ports: `bin/application/ports`
- adapters: `bin/infrastructure/adapters`

**File distribution:**
- Interface layer: 6 files
- Application layer: 12 files
- Domain layer: 19 files
- Infrastructure layer: 11 files
- Config files: 4 files

## 10) Structural Inventory (high-signal)
```text
📄 bin/main.js
📁 bin/interface/cli/
  📄 bin/interface/cli/cli.js
  📄 bin/interface/cli/CommandFactory.js
  📄 bin/interface/cli/DependencyContainer.js
📁 bin/interface/menu/
📁 bin/interface/presenters/
📁 bin/application/ports/
  📄 bin/application/ports/IBundler.js
  📄 bin/application/ports/IDocGenerator.js
  📄 bin/application/ports/IDocumentRepository.js
  📄 bin/application/ports/ILogger.js
  📄 bin/application/ports/IPrompter.js
  📄 bin/application/ports/IValidator.js
📁 bin/application/use-cases/
  📄 bin/application/use-cases/BundleUseCase.js
  📄 bin/application/use-cases/DowngradeSwagger2UseCase.js
  📄 bin/application/use-cases/GenerateDocsUseCase.js
  📄 bin/application/use-cases/ModularizeUseCase.js
📁 bin/domain/entities/
  📄 bin/domain/entities/Component.js
  📄 bin/domain/entities/ComponentFile.js
  📄 bin/domain/entities/ModularizationModel.js
  📄 bin/domain/entities/OpenAPIDocument.js
  📄 bin/domain/entities/PathFile.js
📁 bin/domain/services/
  📄 bin/domain/services/ComponentSplitterService.js
  📄 bin/domain/services/ModelValidator.js
  📄 bin/domain/services/ModularizationModelBuilder.js
  📄 bin/domain/services/NameNormalizerService.js
  📄 bin/domain/services/ParameterExtractorService.js
  📄 bin/domain/services/ReferenceFixerService.js
  📄 bin/domain/services/ReferenceResolver.js
  📄 bin/domain/services/ResponseDeduplicatorService.js
  📄 bin/domain/services/ResponseExtractorService.js
📁 bin/domain/value-objects/
  📄 bin/domain/value-objects/FilePath.js
  📄 bin/domain/value-objects/StatusCode.js
📁 bin/infrastructure/adapters/
  📄 bin/infrastructure/adapters/ApiSpecConverterDowngrader.js
  📄 bin/infrastructure/adapters/InquirerPrompter.js
  📄 bin/infrastructure/adapters/ModularizationWriter.js
  📄 bin/infrastructure/adapters/RedoclyBundler.js
  📄 bin/infrastructure/adapters/RedoclyValidator.js
  📄 bin/infrastructure/adapters/WiddershinsDocGenerator.js
  📄 bin/infrastructure/adapters/YamlDocumentRepository.js
📁 bin/infrastructure/config/
📁 bin/infrastructure/logging/
📁 bin/infrastructure/utils/
📄 config/bundle.yaml
📄 config/logging.yaml
📄 config/modularize.yaml
📄 config/swagger2.yaml
📄 scripts/ai-context.js
📄 ai/manifest.yml
📄 package.json
📄 .dependency-cruiser.js
```

## 11) Quality gates (summary)
```text
Knip (unused exports/dependencies):
  FAIL: 2 issue(s) detected
  Issues found:
    - bin/main.js: Remove redundant entry pattern
    - knip.json: Remove redundant entry pattern

Dependency Cruiser (architecture boundaries):
  PASS: clean
```

## 12) Ephemeral State (git)
```text
branch: main
last commit: 5929ef2 feat: implement hexagonal architecture
status: 7 modified, 1 untracked
```

---
*Generated with profile: debug | maxLines: 2000 | maxTreeLines: 1200*

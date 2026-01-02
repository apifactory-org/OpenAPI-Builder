# AI Context Pack — OpenAPI Builder

Generated: 2026-01-02T17:56:07.165Z
Repo root: C:\data\@apifactory\oas3-modularize
Product type: node-cli

## 1) Authoritative Intent [DECLARED]
Este repo implementa un CLI orientado a “API contract operations”: convertir una spec OpenAPI 3.x monolítica en estructura modular mantenible, consolidar a bundle validado, generar documentación y exportar a Swagger 2.0 para compatibilidad legacy.


## 2) Product summary [DECLARED]
**Name:** OpenAPI Builder
**Purpose:** CLI para modularizar contratos OpenAPI 3.x, generar bundle, docs Markdown y convertir a Swagger 2.0, siguiendo Clean Architecture (capas, puertos/adaptadores).


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

## 6) Inputs / Outputs
### Inputs
| kind | path | required | exists |
|---|---|---|---|
| config | `./config/modularize.yaml` | no | yes |
| config | `./config/bundle.yaml` | no | yes |
| config | `./config/swagger2.yaml` | no | yes |
| config | `./config/logging.yaml` | no | yes |
| manifest | `./ai/manifest.yml` | no | yes |
| openapi_spec | `(varies: --build)` | yes |  |

### Outputs
| path | description | guaranteed_after_success | exists |
|---|---|---|---|
| `./src` | Estructura modular generada desde un OpenAPI monolítico | true | no |
| `./dist/bundle.yaml` | Bundle OpenAPI 3 consolidado | true | no |
| `./docs/api.md` | Documentación Markdown generada | true | no |
| `./dist/swagger2.yaml` | Conversión a Swagger 2.0 | true | no |

## 7) Architecture map (hexagonal) [MEASURED]
- interface: `bin/interface`
- application: `bin/application`
- domain: `bin/domain`
- infrastructure: `bin/infrastructure`
- ports: `bin/application/ports`
- adapters: `bin/infrastructure/adapters`

## 8) Structural Inventory (high-signal)
```text
bin/main.js
bin/interface/cli/
bin/interface/cli/cli.js
bin/interface/cli/CommandFactory.js
bin/interface/cli/DependencyContainer.js
bin/interface/menu/
bin/interface/presenters/
bin/application/ports/
bin/application/ports/IBundler.js
bin/application/ports/IDocGenerator.js
bin/application/ports/IDocumentRepository.js
bin/application/ports/ILogger.js
bin/application/ports/IPrompter.js
bin/application/ports/IValidator.js
bin/application/use-cases/
bin/application/use-cases/BundleUseCase.js
bin/application/use-cases/DowngradeSwagger2UseCase.js
bin/application/use-cases/GenerateDocsUseCase.js
bin/application/use-cases/ModularizeUseCase.js
bin/domain/entities/
bin/domain/entities/Component.js
bin/domain/entities/ComponentFile.js
bin/domain/entities/ModularizationModel.js
bin/domain/entities/OpenAPIDocument.js
bin/domain/entities/PathFile.js
bin/domain/services/
bin/domain/services/ComponentSplitterService.js
bin/domain/services/ModelValidator.js
bin/domain/services/ModularizationModelBuilder.js
bin/domain/services/NameNormalizerService.js
bin/domain/services/ParameterExtractorService.js
bin/domain/services/ReferenceFixerService.js
bin/domain/services/ReferenceResolver.js
bin/domain/services/ResponseDeduplicatorService.js
bin/domain/services/ResponseExtractorService.js
bin/domain/value-objects/
bin/domain/value-objects/FilePath.js
bin/domain/value-objects/StatusCode.js
bin/infrastructure/adapters/
bin/infrastructure/adapters/ApiSpecConverterDowngrader.js
bin/infrastructure/adapters/InquirerPrompter.js
bin/infrastructure/adapters/ModularizationWriter.js
bin/infrastructure/adapters/RedoclyBundler.js
bin/infrastructure/adapters/RedoclyValidator.js
bin/infrastructure/adapters/WiddershinsDocGenerator.js
bin/infrastructure/adapters/YamlDocumentRepository.js
bin/infrastructure/config/
bin/infrastructure/logging/
bin/infrastructure/utils/
config/bundle.yaml
config/logging.yaml
config/modularize.yaml
config/swagger2.yaml
scripts/ai-context.js
ai/manifest.yml
package.json
.dependency-cruiser.js
```

## 9) Quality gates (summary)
```text
knip: fail: bin/main.js    knip.json  [90mRemove redundant [97mentry[90m pattern[39m
dependency-cruiser: pass: architecture boundary check passed
```

## 10) Ephemeral State (debug-only)
```text
git: (not included)
```

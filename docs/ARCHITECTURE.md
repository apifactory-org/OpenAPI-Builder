# Arquitectura

Este documento describe la arquitectura y diseño interno de **OpenAPI Builder**.

## 🎯 Visión General

OpenAPI Builder implementa **Clean Architecture** (también conocida como arquitectura hexagonal o puertos y adaptadores), con capas claramente separadas y dependencias unidireccionales desde el exterior hacia el interior.

## 📐 Principios Arquitectónicos

### Reglas de Dependencia

```
interface → application → domain ← infrastructure
```

1. **Domain** no depende de ninguna otra capa (núcleo puro)
2. **Application** depende solo de Domain
3. **Infrastructure** depende de Domain y Application
4. **Interface** orquesta todo coordinando Application e Infrastructure

### Invariantes

- **Domain no debe importar Infrastructure** (verificado con dependency-cruiser)
- Los paths relativos se resuelven contra el directorio de trabajo (cwd)
- No se modifica el OpenAPI original; las salidas van a `./src`, `./dist`, `./docs`

## 🏗️ Capas de la Arquitectura

### 1. Interface (`bin/interface/`)

Punto de entrada del usuario. Maneja la interacción con CLI, menús y presentación de resultados.

**Componentes:**

```
bin/interface/
├── cli/
│   ├── cli.js                  # Punto de entrada CLI
│   ├── CommandFactory.js       # Factory de comandos
│   └── DependencyContainer.js  # Inyección de dependencias
├── menu/                       # Menús interactivos
└── presenters/                 # Formateo de salida
```

**Responsabilidades:**
- Parsear flags y argumentos CLI
- Crear instancias de use cases con dependencias inyectadas
- Formatear y presentar resultados al usuario
- Manejar errores y logging de interfaz

### 2. Application (`bin/application/`)

Lógica de aplicación. Orquesta casos de uso y define contratos (ports) para servicios externos.

**Componentes:**

```
bin/application/
├── ports/                      # Interfaces/Contratos
│   ├── IBundler.js
│   ├── IDocGenerator.js
│   ├── IDocumentRepository.js
│   ├── ILogger.js
│   ├── IPrompter.js
│   └── IValidator.js
└── use-cases/                  # Casos de uso
    ├── ModularizeUseCase.js
    ├── BundleUseCase.js
    ├── GenerateDocsUseCase.js
    └── DowngradeSwagger2UseCase.js
```

**Ports (Interfaces):**
- `IBundler`: Consolidar módulos en bundle
- `IDocGenerator`: Generar documentación
- `IDocumentRepository`: Leer/escribir archivos YAML/JSON
- `IValidator`: Validar especificaciones OpenAPI
- `ILogger`: Sistema de logging
- `IPrompter`: Interacción con usuario

**Use Cases:**
- **ModularizeUseCase**: Divide OpenAPI monolítico en estructura modular
- **BundleUseCase**: Consolida módulos en bundle único
- **GenerateDocsUseCase**: Genera documentación Markdown
- **DowngradeSwagger2UseCase**: Convierte OpenAPI 3.x a Swagger 2.0

### 3. Domain (`bin/domain/`)

Núcleo del negocio. Contiene la lógica de dominio pura, sin dependencias externas.

**Componentes:**

```
bin/domain/
├── entities/                   # Entidades de dominio
│   ├── Component.js
│   ├── ComponentFile.js
│   ├── ModularizationModel.js
│   ├── OpenAPIDocument.js
│   └── PathFile.js
├── services/                   # Servicios de dominio
│   ├── ComponentSplitterService.js
│   ├── ModelValidator.js
│   ├── ModularizationModelBuilder.js
│   ├── NameNormalizerService.js
│   ├── ParameterExtractorService.js
│   ├── ReferenceFixerService.js
│   ├── ReferenceResolver.js
│   ├── ResponseDeduplicatorService.js
│   └── ResponseExtractorService.js
└── value-objects/              # Value Objects
    ├── FilePath.js
    └── StatusCode.js
```

**Entidades:**
- `OpenAPIDocument`: Representación de documento OpenAPI
- `ModularizationModel`: Modelo del proceso de modularización
- `Component`: Componente reutilizable (schema, response, etc.)
- `ComponentFile`/`PathFile`: Archivos modulares generados

**Servicios de Dominio:**
- `NameNormalizerService`: Normaliza nombres de responses
- `ResponseExtractorService`: Extrae responses inline
- `ResponseDeduplicatorService`: Deduplica responses similares
- `ParameterExtractorService`: Extrae parámetros comunes
- `ComponentSplitterService`: Divide componentes por tipo
- `ReferenceFixerService`: Corrige referencias $ref
- `ReferenceResolver`: Resuelve referencias entre archivos
- `ModularizationModelBuilder`: Construye modelo de modularización
- `ModelValidator`: Valida integridad del modelo

**Value Objects:**
- `FilePath`: Rutas de archivos inmutables
- `StatusCode`: Códigos de estado HTTP

### 4. Infrastructure (`bin/infrastructure/`)

Implementaciones concretas de los ports. Adaptadores a bibliotecas externas.

**Componentes:**

```
bin/infrastructure/
├── adapters/                   # Implementaciones de ports
│   ├── YamlDocumentRepository.js       # IDocumentRepository
│   ├── RedoclyBundler.js               # IBundler
│   ├── RedoclyValidator.js             # IValidator
│   ├── WiddershinsDocGenerator.js      # IDocGenerator
│   ├── ApiSpecConverterDowngrader.js   # Swagger 2 converter
│   ├── InquirerPrompter.js             # IPrompter
│   └── ModularizationWriter.js         # Escritura modular
├── config/                     # Configuración
├── logging/                    # Sistema de logging
└── utils/                      # Utilidades
```

**Adapters:**
- `YamlDocumentRepository`: Lectura/escritura de YAML con js-yaml
- `RedoclyBundler`: Bundling usando @redocly/cli
- `RedoclyValidator`: Validación con Redocly
- `WiddershinsDocGenerator`: Generación de docs con Widdershins
- `ApiSpecConverterDowngrader`: Conversión a Swagger 2.0
- `InquirerPrompter`: Prompts interactivos con Inquirer
- `ModularizationWriter`: Escribe estructura modular en disco

## 🔄 Flujo de Ejecución

### Comando: modularize

```
1. CLI (interface) parsea flags
   └─> --build apunta a OpenAPI monolítico

2. DependencyContainer inyecta:
   └─> ModularizeUseCase + servicios de domain + adapters

3. ModularizeUseCase ejecuta:
   ├─> YamlDocumentRepository.read(openapi.yaml)
   ├─> RedoclyValidator.validate(document)
   ├─> NameNormalizerService.normalize(responses)
   ├─> ResponseExtractorService.extract(inline responses)
   ├─> ResponseDeduplicatorService.deduplicate()
   ├─> ParameterExtractorService.extract(common params)
   ├─> ComponentSplitterService.split(schemas, responses, params)
   ├─> ReferenceFixerService.fix($refs)
   ├─> ModularizationModelBuilder.build(model)
   ├─> ModelValidator.validate(model)
   └─> ModularizationWriter.write(./src/)

4. Resultado: ./src/main.yaml + components/ + paths/
```

### Comando: bundle

```
1. CLI parsea: -i ./src/main.yaml -o ./dist/bundle.yaml

2. BundleUseCase ejecuta:
   ├─> RedoclyBundler.bundle(input)
   ├─> Opciones: remove-unused, validate, no-anchors
   └─> YamlDocumentRepository.write(output)

3. Resultado: ./dist/bundle.yaml
```

### Comando: docs

```
1. CLI parsea: -i ./dist/bundle.yaml -o ./docs/api.md

2. GenerateDocsUseCase ejecuta:
   ├─> YamlDocumentRepository.read(bundle)
   └─> WiddershinsDocGenerator.generate(markdown)

3. Resultado: ./docs/api.md
```

### Comando: swagger2

```
1. CLI parsea: -i ./dist/bundle.yaml -o ./dist/swagger2.yaml

2. DowngradeSwagger2UseCase ejecuta:
   ├─> YamlDocumentRepository.read(bundle)
   ├─> ApiSpecConverterDowngrader.convert(to swagger 2.0)
   └─> YamlDocumentRepository.write(output)

3. Resultado: ./dist/swagger2.yaml
```

## 🔌 Puertos y Adaptadores

### Patrón de Diseño

Los **ports** (interfaces) definen contratos en la capa de aplicación. Los **adapters** (implementaciones concretas) viven en infrastructure.

Ejemplo:

```javascript
// Port (application/ports/IValidator.js)
class IValidator {
  async validate(document) {
    throw new Error('Must implement validate');
  }
}

// Adapter (infrastructure/adapters/RedoclyValidator.js)
class RedoclyValidator extends IValidator {
  async validate(document) {
    // Implementación usando @redocly/cli
  }
}
```

### Inyección de Dependencias

El `DependencyContainer` crea instancias concretas y las inyecta en use cases:

```javascript
// interface/cli/DependencyContainer.js
const validator = new RedoclyValidator();
const repository = new YamlDocumentRepository();
const useCase = new ModularizeUseCase(validator, repository, ...);
```

## 📊 Diagramas

### Diagrama de Capas

```
┌─────────────────────────────────────┐
│         INTERFACE LAYER             │
│  (CLI, Menu, Presenters)            │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│       APPLICATION LAYER             │
│  (Use Cases, Ports)                 │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         DOMAIN LAYER                │
│  (Entities, Services, VOs)          │
│  ◄── NO DEPENDENCIES ──             │
└─────────────────────────────────────┘
               ▲
┌──────────────┴──────────────────────┐
│      INFRASTRUCTURE LAYER           │
│  (Adapters: Redocly, Widdershins)   │
└─────────────────────────────────────┘
```

## 🛡️ Validación de Arquitectura

El proyecto usa `dependency-cruiser` para verificar reglas arquitectónicas:

```javascript
// .dependency-cruiser.js
forbidden: [
  {
    name: 'domain-cannot-import-infrastructure',
    from: { path: 'bin/domain' },
    to: { path: 'bin/infrastructure' }
  }
]
```

Ejecutar validación:

```bash
npm run validate:arch
```

## 🧪 Testing

La arquitectura facilita testing mediante:

1. **Unit tests**: Servicios de domain sin dependencias externas
2. **Integration tests**: Use cases con mocks de adapters
3. **E2E tests**: CLI completo con archivos reales

Ver `tests/` para ejemplos.

## 🔍 Beneficios de esta Arquitectura

1. **Testabilidad**: Lógica de negocio aislada y testeable
2. **Mantenibilidad**: Cambios en bibliotecas externas solo afectan adapters
3. **Flexibilidad**: Fácil intercambiar Redocly por otra herramienta
4. **Claridad**: Separación clara de responsabilidades
5. **Escalabilidad**: Agregar nuevos comandos sin afectar existentes
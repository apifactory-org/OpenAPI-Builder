# Configuración

Guía completa de configuración para **OpenAPI Builder**.

## 📁 Archivos de Configuración

El proyecto utiliza archivos YAML en `./config/` para personalizar el comportamiento de cada comando:

```
config/
├── modularize.yaml     # Configuración de modularización
├── bundle.yaml         # Opciones de bundling
├── swagger2.yaml       # Conversión a Swagger 2.0
└── logging.yaml        # Sistema de logging
```

## ⚙️ Configuración por Comando

### modularize.yaml

Controla cómo se divide el OpenAPI monolítico en estructura modular.

```yaml
# config/modularize.yaml
output:
  directory: ./src
  mainFile: main.yaml
  
components:
  directory: components
  splitBy: type  # type | tag | path
  
paths:
  directory: paths
  groupBy: tag  # tag | path | resource
  
references:
  fixRelative: true
  deduplicateComponents: true
  
responses:
  normalize: true
  extractInline: true
  deduplicate: true
  
parameters:
  extractCommon: true
  threshold: 2  # Mínimo de repeticiones para extraer
```

**Opciones:**

| Opción | Tipo | Default | Descripción |
|--------|------|---------|-------------|
| `output.directory` | string | `./src` | Directorio de salida modular |
| `output.mainFile` | string | `main.yaml` | Archivo principal de entrada |
| `components.splitBy` | enum | `type` | Criterio para dividir componentes: `type`, `tag`, `path` |
| `paths.groupBy` | enum | `tag` | Criterio para agrupar paths: `tag`, `path`, `resource` |
| `references.fixRelative` | boolean | `true` | Corregir referencias relativas automáticamente |
| `references.deduplicateComponents` | boolean | `true` | Eliminar componentes duplicados |
| `responses.normalize` | boolean | `true` | Normalizar nombres de responses |
| `responses.extractInline` | boolean | `true` | Extraer responses inline a componentes |
| `responses.deduplicate` | boolean | `true` | Deduplicar responses similares |
| `parameters.extractCommon` | boolean | `true` | Extraer parámetros comunes |
| `parameters.threshold` | number | `2` | Número mínimo de repeticiones para extraer parámetro |

### bundle.yaml

Configura el proceso de consolidación de módulos en bundle.

```yaml
# config/bundle.yaml
input:
  entrypoint: ./src/main.yaml
  
output:
  file: ./dist/bundle.yaml
  format: yaml  # yaml | json
  
options:
  removeUnused: true
  validate: true
  noAnchors: false
  dereferenceAll: false
  
redocly:
  extends:
    - recommended
  rules:
    operation-operationId: error
    no-unused-components: warn
```

**Opciones:**

| Opción | Tipo | Default | Descripción |
|--------|------|---------|-------------|
| `input.entrypoint` | string | `./src/main.yaml` | Punto de entrada modular |
| `output.file` | string | `./dist/bundle.yaml` | Archivo bundle de salida |
| `output.format` | enum | `yaml` | Formato de salida: `yaml`, `json` |
| `options.removeUnused` | boolean | `true` | Eliminar componentes no usados |
| `options.validate` | boolean | `true` | Validar bundle antes de escribir |
| `options.noAnchors` | boolean | `false` | Remover anchors YAML |
| `options.dereferenceAll` | boolean | `false` | Dereferenciar todas las $ref |
| `redocly.*` | object | - | Configuración de Redocly CLI |

### swagger2.yaml

Controla la conversión de OpenAPI 3.x a Swagger 2.0.

```yaml
# config/swagger2.yaml
input:
  bundle: ./dist/bundle.yaml
  
output:
  file: ./dist/swagger2.yaml
  
conversion:
  patch: true  # Aplicar patches de compatibilidad
  strictValidation: false
  
compatibility:
  servers: first  # first | all | none
  callbacks: ignore  # ignore | warn | error
  links: ignore
  
preserve:
  examples: true
  descriptions: true
  vendorExtensions: true
```

**Opciones:**

| Opción | Tipo | Default | Descripción |
|--------|------|---------|-------------|
| `input.bundle` | string | `./dist/bundle.yaml` | Bundle OpenAPI 3.x de entrada |
| `output.file` | string | `./dist/swagger2.yaml` | Archivo Swagger 2.0 de salida |
| `conversion.patch` | boolean | `true` | Aplicar patches de compatibilidad |
| `conversion.strictValidation` | boolean | `false` | Validación estricta durante conversión |
| `compatibility.servers` | enum | `first` | Cómo manejar servers: `first`, `all`, `none` |
| `compatibility.callbacks` | enum | `ignore` | Manejo de callbacks: `ignore`, `warn`, `error` |
| `compatibility.links` | enum | `ignore` | Manejo de links |
| `preserve.examples` | boolean | `true` | Preservar ejemplos |
| `preserve.descriptions` | boolean | `true` | Preservar descripciones |
| `preserve.vendorExtensions` | boolean | `true` | Preservar extensiones vendor (x-*) |

### logging.yaml

Configura el sistema de logging.

```yaml
# config/logging.yaml
level: info  # error | warn | info | debug | trace

transports:
  console:
    enabled: true
    colorize: true
    timestamp: true
    
  file:
    enabled: false
    filename: ./logs/openapi-builder.log
    maxSize: 10485760  # 10MB
    maxFiles: 5

format:
  json: false
  prettyPrint: true
  
filters:
  hideSecrets: true
  maxMessageLength: 1000
```

**Opciones:**

| Opción | Tipo | Default | Descripción |
|--------|------|---------|-------------|
| `level` | enum | `info` | Nivel de log: `error`, `warn`, `info`, `debug`, `trace` |
| `transports.console.enabled` | boolean | `true` | Habilitar logging a consola |
| `transports.console.colorize` | boolean | `true` | Colorear logs |
| `transports.file.enabled` | boolean | `false` | Habilitar logging a archivo |
| `transports.file.filename` | string | - | Ruta del archivo de log |
| `format.json` | boolean | `false` | Formato JSON para logs |
| `format.prettyPrint` | boolean | `true` | Pretty print de objetos |

## 🚩 Flags del CLI

### Comando: modularize

```bash
openapi-builder modularize [options]
```

| Flag | Tipo | Requerido | Descripción |
|------|------|-----------|-------------|
| `--build <file>` | string | ✅ | Archivo OpenAPI monolítico (yaml/json) |
| `-c, --config <file>` | string | ❌ | Archivo de configuración personalizado |
| `-o, --output <dir>` | string | ❌ | Directorio de salida (default: `./src`) |
| `-v, --verbose` | boolean | ❌ | Modo verbose |
| `--dry-run` | boolean | ❌ | Simular sin escribir archivos |

**Ejemplos:**

```bash
# Básico
openapi-builder modularize --build ./api/openapi.yaml

# Con configuración personalizada
openapi-builder modularize --build ./api/openapi.yaml -c ./my-config.yaml

# Dry run para preview
openapi-builder modularize --build ./api/openapi.yaml --dry-run

# Output personalizado
openapi-builder modularize --build ./api/openapi.yaml -o ./my-modules
```

### Comando: bundle

```bash
openapi-builder bundle [options]
```

| Flag | Tipo | Requerido | Descripción |
|------|------|-----------|-------------|
| `-i, --input <file>` | string | ❌ | Entrypoint modular (default: `./src/main.yaml`) |
| `-o, --output <file>` | string | ❌ | Archivo bundle (default: `./dist/bundle.yaml`) |
| `-c, --config <file>` | string | ❌ | Archivo de configuración |
| `--remove-unused` | boolean | ❌ | Eliminar componentes no usados |
| `--validate` | boolean | ❌ | Validar bundle |
| `--no-anchors` | boolean | ❌ | Remover YAML anchors |
| `-v, --verbose` | boolean | ❌ | Modo verbose |

**Ejemplos:**

```bash
# Básico
openapi-builder bundle

# Con validación y limpieza
openapi-builder bundle --remove-unused --validate

# Input/output personalizados
openapi-builder bundle -i ./modules/api.yaml -o ./build/api-bundle.yaml

# Sin anchors YAML
openapi-builder bundle --no-anchors
```

### Comando: docs

```bash
openapi-builder docs [options]
```

| Flag | Tipo | Requerido | Descripción |
|------|------|-----------|-------------|
| `-i, --input <file>` | string | ❌ | Bundle OpenAPI (default: `./dist/bundle.yaml`) |
| `-o, --output <file>` | string | ❌ | Archivo Markdown (default: `./docs/api.md`) |
| `-c, --config <file>` | string | ❌ | Archivo de configuración |
| `--template <name>` | string | ❌ | Template de documentación |
| `-v, --verbose` | boolean | ❌ | Modo verbose |

**Ejemplos:**

```bash
# Básico
openapi-builder docs

# Con template personalizado
openapi-builder docs --template custom

# Output personalizado
openapi-builder docs -o ./documentation/API.md
```

### Comando: swagger2

```bash
openapi-builder swagger2 [options]
```

| Flag | Tipo | Requerido | Descripción |
|------|------|-----------|-------------|
| `-i, --input <file>` | string | ❌ | Bundle OpenAPI 3 (default: `./dist/bundle.yaml`) |
| `-o, --output <file>` | string | ❌ | Archivo Swagger 2 (default: `./dist/swagger2.yaml`) |
| `-c, --config <file>` | string | ❌ | Archivo de configuración |
| `--patch` | boolean | ❌ | Aplicar patches de compatibilidad |
| `-v, --verbose` | boolean | ❌ | Modo verbose |

**Ejemplos:**

```bash
# Básico
openapi-builder swagger2

# Con patches de compatibilidad
openapi-builder swagger2 --patch

# Input/output personalizados
openapi-builder swagger2 -i ./api/bundle.yaml -o ./legacy/api-v2.yaml
```

## 🔧 Variables de Entorno

Puedes configurar el CLI mediante variables de entorno:

```bash
# Nivel de logging
export OPENAPI_BUILDER_LOG_LEVEL=debug

# Directorio de configuración
export OPENAPI_BUILDER_CONFIG_DIR=./my-configs

# Deshabilitar colores
export NO_COLOR=1

# Modo verbose global
export OPENAPI_BUILDER_VERBOSE=true
```

## 📝 Orden de Precedencia

La configuración se aplica en este orden (de menor a mayor prioridad):

1. Valores default del código
2. Archivos `./config/*.yaml`
3. Archivo de config personalizado (`-c/--config`)
4. Variables de entorno
5. Flags del CLI

Ejemplo:

```bash
# El flag --output sobrescribe config/modularize.yaml
openapi-builder modularize --build api.yaml -o ./custom-src
```

## 🎯 Perfiles de Configuración

Puedes crear perfiles para diferentes entornos:

```bash
config/
├── modularize.yaml           # Default
├── modularize.dev.yaml       # Desarrollo
├── modularize.prod.yaml      # Producción
└── modularize.ci.yaml        # CI/CD
```

Usar perfil específico:

```bash
openapi-builder modularize --build api.yaml -c ./config/modularize.prod.yaml
```

## 🔍 Validación de Configuración

Para validar tu configuración sin ejecutar el comando:

```bash
openapi-builder validate-config -c ./config/modularize.yaml
```

## 💡 Mejores Prácticas

1. **Versionado**: Incluye archivos de config en git
2. **Secretos**: NO incluyas credenciales en configs (usa env vars)
3. **Defaults**: Mantén configs mínimas, usa defaults cuando sea posible
4. **Documentación**: Comenta configs complejas en el archivo YAML
5. **Validación**: Siempre valida configs antes de CI/CD

## 📚 Ejemplos Completos

### Configuración Mínima

```yaml
# config/modularize.yaml
output:
  directory: ./src
```

### Configuración Completa

```yaml
# config/modularize.yaml
output:
  directory: ./src
  mainFile: main.yaml

components:
  directory: components
  splitBy: type
  
paths:
  directory: paths
  groupBy: tag
  
references:
  fixRelative: true
  deduplicateComponents: true
  
responses:
  normalize: true
  extractInline: true
  deduplicate: true
  
parameters:
  extractCommon: true
  threshold: 2
```
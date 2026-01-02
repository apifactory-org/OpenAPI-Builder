# OpenAPI Builder

CLI para trabajar con contratos OpenAPI 3: modularizar especificaciones monolíticas, generar bundle consolidado, documentación Markdown y convertir a Swagger 2.0.

## 🎯 Propósito

Herramienta orientada a "API contract operations" que permite convertir una especificación OpenAPI 3.x monolítica en una estructura modular mantenible, consolidarla en un bundle validado, generar documentación y exportar a Swagger 2.0 para compatibilidad legacy.

## ✨ Características

- **Modularización**: Divide especificaciones OpenAPI monolíticas en estructura modular organizada
- **Bundling**: Consolida módulos en un bundle OpenAPI 3 validado
- **Documentación**: Genera documentación Markdown automática desde el bundle
- **Compatibilidad**: Convierte OpenAPI 3.x a Swagger 2.0
- **Clean Architecture**: Implementa arquitectura hexagonal (capas, puertos/adaptadores)
- **Validación**: Valida especificaciones antes y después de las transformaciones

## 📋 Requisitos

- Node.js >= 16
- npm >= 8

## 📦 Instalación

```bash
npm install -g @apifactory/openapi-builder
```

O como dependencia del proyecto:

```bash
npm install --save-dev @apifactory/openapi-builder
```

## 🚀 Uso

### Comando: modularize

Divide un OpenAPI monolítico en estructura modular con corrección de referencias y deduplicación.

```bash
openapi-builder modularize --build ./api/openapi.yaml
```

**Salida**: `./src/` con estructura modular (main.yaml + components/ + paths/)

### Comando: bundle

Consolida estructura modular en bundle OpenAPI 3.

```bash
openapi-builder bundle -i ./src/main.yaml -o ./dist/bundle.yaml
```

**Opciones**:
- `-i, --input`: Entrypoint modular (default: `./src/main.yaml`)
- `-o, --output`: Ruta del bundle (default: `./dist/bundle.yaml`)

### Comando: docs

Genera documentación Markdown desde el bundle.

```bash
openapi-builder docs -i ./dist/bundle.yaml -o ./docs/api.md
```

**Opciones**:
- `-i, --input`: Bundle OpenAPI (default: `./dist/bundle.yaml`)
- `-o, --output`: Ruta Markdown (default: `./docs/api.md`)

### Comando: swagger2

Convierte OpenAPI 3.x a Swagger 2.0.

```bash
openapi-builder swagger2 -i ./dist/bundle.yaml -o ./dist/swagger2.yaml
```

**Opciones**:
- `-i, --input`: Bundle OpenAPI 3 (default: `./dist/bundle.yaml`)
- `-o, --output`: Ruta Swagger 2 (default: `./dist/swagger2.yaml`)

## 📁 Estructura de Salida

```
proyecto/
├── src/                    # Estructura modular (modularize)
│   ├── main.yaml
│   ├── components/
│   └── paths/
├── dist/                   # Outputs consolidados
│   ├── bundle.yaml        # Bundle OpenAPI 3 (bundle)
│   └── swagger2.yaml      # Swagger 2.0 (swagger2)
└── docs/                   # Documentación
    └── api.md             # Docs Markdown (docs)
```

## ⚙️ Configuración

Los comandos pueden personalizarse mediante archivos YAML en `./config/`:

- `config/modularize.yaml`: Configuración de modularización
- `config/bundle.yaml`: Opciones de bundling
- `config/swagger2.yaml`: Configuración de conversión
- `config/logging.yaml`: Configuración de logging

## 🏗️ Arquitectura

El proyecto sigue **Clean Architecture** con capas claramente definidas:

```
bin/
├── interface/          # CLI, menús, presenters
├── application/        # Use cases, ports
├── domain/            # Entities, services, value objects
└── infrastructure/    # Adapters (Redocly, Widdershins, etc.)
```

Ver [ARCHITECTURE.md](./ARCHITECTURE.md) para más detalles.

## 📖 Documentación

- [Arquitectura](./ARCHITECTURE.md) - Diseño y componentes del sistema
- [Configuración](./CONFIGURATION.md) - Opciones y personalización
- [Contribución](./CONTRIBUTING.md) - Guía para colaboradores
- [Contexto para IA](./AI_CONTEXT.md) - Información para herramientas de IA

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Lee la [guía de contribución](./CONTRIBUTING.md)
2. Respeta las reglas de arquitectura (domain no importa infrastructure)
3. Mantén compatibilidad con los flags del CLI

## 📄 Licencia

MIT

## 🔗 Enlaces Útiles

- [OpenAPI Specification 3.0](https://spec.openapis.org/oas/v3.0.0)
- [Redocly CLI](https://redocly.com/docs/cli/)
- [Widdershins](https://github.com/Mermade/widdershins)
# oas3-modularize

CLI para trabajar con especificaciones OpenAPI 3 (OAS3) de forma más productiva.
Convierte un archivo monolítico .yaml en una estructura modular lista para Redocly, genera bundle, valida y produce documentación Markdown.

-------------------------------------------------------------------------------

## 🚀 Características principales

- Modularización automática
  Convierte un archivo único OAS en:
  
      src/
        openapi.yaml
        components/*.yaml
        paths/*.yaml

- Corrección inteligente de referencias $ref
  - Ajusta rutas relativas entre componentes
  - Ajusta $ref internos de schemas, requestBodies, responses, etc.
  - Ajusta referencias desde paths → openapi.yaml

- Validación con Redocly CLI
  - Ejecuta redocly lint automáticamente
  - Muestra advertencias y errores de forma amigable

- Generación de bundle
  - Usa redocly bundle
  - --dereferenced
  - --remove-unused-components

- Generación de documentación Markdown
  - Convierte OpenAPI → Markdown usando Widdershins

- Menú interactivo (no más memorizar comandos)
  - Modularizar
  - Bundle
  - Docs
  - Pipeline completo

-------------------------------------------------------------------------------

## 📦 Instalación (global)

Este CLI está pensado para usarse instalado globalmente, sin necesidad de clonar el repositorio ni agregar dependencias a cada proyecto.

Instalar globalmente:

    npm install -g @apifactory/oas3-modularize

Después de eso, el comando queda disponible en todo el sistema:

    oas3-modularize

-------------------------------------------------------------------------------

## 🧩 Uso desde el menú interactivo (recomendado)

Simplemente ejecuta:

    oas3-modularize

Verás un menú como este:

    🧩 oas3-modularize - Menú interactivo

    ¿Qué quieres hacer?

    1) Modularizar archivo OpenAPI YAML
    2) Generar bundle con Redocly
    3) Generar documentación Markdown
    4) Ejecutar todo el pipeline
    Salir

-------------------------------------------------------------------------------

## 🛠 Uso mediante subcomandos

### 1. Modularizar

    oas3-modularize modularize --build ./openapi.yaml

### 2. Generar Bundle

    oas3-modularize bundle \
      --input src/openapi.yaml \
      --output dist/openapi.yaml

### 3. Generar documentación Markdown

    oas3-modularize docs \
      --input dist/openapi.yaml \
      --output dist/api.md

### 4. Pipeline completo

    oas3-modularize build-all --build ./openapi.yaml

Incluye:
1. Modularización → src/
2. Bundle → dist/openapi.yaml
3. Docs → dist/api.md

-------------------------------------------------------------------------------

## 📁 Estructura generada

    src/
      openapi.yaml
      components/
        schemas.yaml
        requestBodies.yaml
        responses.yaml
        ...
      paths/
        users.yaml
        users-id.yaml
        ...
    dist/
      openapi.yaml      (bundle final)
      api.md            (docs Markdown)

-------------------------------------------------------------------------------

## ⚙ Requisitos

- Node.js 16+ (recomendado: 18+)

IMPORTANTE:
No necesitas instalar @redocly/cli ni widdershins en tus proyectos.
Estas herramientas vienen incluidas como dependencias internas del CLI.

-------------------------------------------------------------------------------

## 🤝 Contribuir

1. Haz un fork del repositorio
2. Crea una rama con tu mejora
3. Haz un PR describiendo el cambio

-------------------------------------------------------------------------------

## 📄 Licencia

MIT License

-------------------------------------------------------------------------------

## ✨ Autor

API Factory  
Herramientas modernas para el diseño, documentación y automatización de APIs.

# oas3-modularize

CLI para trabajar con especificaciones **OpenAPI 3 (OAS3)** de forma más productiva.  
Convierte un archivo monolítico `.yaml` en una estructura modular lista para Redocly, genera bundle, valida y produce documentación Markdown.

---

## 🚀 Características principales

- **Modularización automática**  
  Convierte un archivo único OAS en:
  ```
  src/
    openapi.yaml
    components/*.yaml
    paths/*.yaml
  ```

- **Corrección inteligente de referencias `$ref`**
  - Ajusta rutas relativas entre componentes
  - Ajusta `$ref` internos de `schemas`, `requestBodies`, `responses`, etc.
  - Ajusta referencias desde paths → openapi.yaml

- **Validación con Redocly CLI**
  - Ejecuta `redocly lint` automáticamente
  - Muestra advertencias y errores de forma amigable

- **Generación de bundle**
  - Usa `redocly bundle`
  - `--dereferenced`
  - `--remove-unused-components`

- **Generación de documentación Markdown**
  - Convierte OpenAPI → Markdown usando **Widdershins**

- **Menú interactivo (no más memorizar comandos)**
  - Modularizar
  - Bundle
  - Docs
  - Pipeline completo

---

## 📦 Instalación

Puedes usar este CLI **sin descargar el repositorio**, instalándolo directamente desde npm.

### 🔹 Instalar en un proyecto (recomendado)

```bash
npm install @apifactory/oas3-modularize --save-dev
```

Ejecutar:

```bash
npx oas3-modularize
```

### 🔹 Instalar globalmente

```bash
npm install -g @apifactory/oas3-modularize
```

Ejecutar:

```bash
oas3-modularize
```

---

## 🧩 Uso desde el menú interactivo (recomendado)

Ejecuta el comando sin argumentos:

```bash
npx oas3-modularize
```

Verás un menú así:

```
🧩 oas3-modularize - Menú interactivo

¿Qué quieres hacer?

1) Modularizar archivo OpenAPI YAML
2) Generar bundle con Redocly
3) Generar documentación Markdown
4) Ejecutar todo el pipeline
Salir
```

---

## 🛠 Uso mediante subcomandos

### 1. Modularizar

```bash
oas3-modularize modularize --build ./openapi.yaml
```

Salida:

```
src/
  openapi.yaml
  components/
  paths/
```

### 2. Generar Bundle

```bash
oas3-modularize bundle \
  --input src/openapi.yaml \
  --output dist/openapi.yaml
```

### 3. Generar documentación Markdown

```bash
oas3-modularize docs \
  --input dist/openapi.yaml \
  --output dist/api.md
```

### 4. Pipeline completo

```bash
oas3-modularize build-all --build openapi.yaml
```

Incluye:

1. Modularización → `src/`
2. Bundle → `dist/openapi.yaml`
3. Docs → `dist/api.md`

---

## 📁 Estructura generada

```
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
```

---

## ⚙ Requisitos

- Node.js 16+ (recomendado: 18+)
- `@redocly/cli` (instalado como devDependency)
- `widdershins` (instalado como devDependency)

---

## 🧪 Scripts incluidos

```bash
npm run modularize
npm run bundle
npm run docs
npm run build:all
```

---

## 🤝 Contribuir

1. Haz un fork del repositorio  
2. Crea una rama con tu mejora  
3. Haz un PR describiendo el cambio

---

## 📄 Licencia

MIT License

---

## ✨ Autor

**API Factory**  
Herramientas modernas para el diseño, documentación y automatización de APIs.


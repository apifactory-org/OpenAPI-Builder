# openapi-builder

CLI profesional para trabajar con especificaciones **OpenAPI 3 (OAS3)**: modularización completa, validación, bundle, documentación Markdown y conversión a Swagger 2.0.

---

## 🚀 Características principales

### 🔧 Modularización automática

Convierte un archivo único OpenAPI en una estructura modular:

```
src/
  main.yaml
  components/
    schemas/*.yaml
    responses/*.yaml
    requestBodies/*.yaml
    ...
  paths/*.yaml
```

Incluye:

* extracción de respuestas inline
* deduplicación
* normalización opcional de nombres
* corrección inteligente de `$ref` según la estructura generada

### ✔ Validación integrada

Valida automáticamente el contrato modularizado usando Redocly CLI (incluido como dependencia interna; el usuario no instala nada).

### 📦 Generación de bundle (OAS3)

Produce un archivo OpenAPI unificado desde la estructura modular.

Opciones:

* dereference
* remove-unused-components
* inject-format
* skip validation

### 📚 Generación de documentación Markdown

Convierte OpenAPI a Markdown con Widdershins (incluido como dependencia interna).

### 🔄 Conversión OAS3 → Swagger 2.0

Convierte cualquier bundle OpenAPI 3 en un archivo Swagger 2.0 usando **api-spec-converter**.

### 🧠 Menú interactivo

Incluye un menú que evita tener que memorizar comandos.

---

## 📦 Instalación (global o por proyecto)

Instalación global:

```
npm install -g @apifactory/openapi-builder
```

O bien usarlo sin instalación mediante **npx**:

```
npx @apifactory/openapi-builder
```

---

## 🧩 Menú interactivo (recomendado)

Ejecuta:

```
openapi-builder
```

Menú disponible:

```
🧩 openapi-builder - Menú interactivo

1) Modularizar OpenAPI 3 → Estructura modular
2) Generar bundle OpenAPI 3
3) Generar documentación Markdown
4) Convertir OpenAPI 3 → Swagger 2.0
Salir
```

---

## 🛠 Uso mediante subcomandos

### 1. Modularizar

```
openapi-builder modularize -i ./openapi.yaml
```

### 2. Generar bundle

```
openapi-builder bundle \
  -i ./src/main.yaml \
  -o ./dist/openapi.yaml
```

### 3. Generar documentación Markdown

```
openapi-builder docs \
  -i ./dist/openapi.yaml \
  -o ./docs/api.md
```

### 4. Convertir a Swagger 2.0

```
openapi-builder swagger2 \
  -i ./dist/openapi.yaml \
  -o ./dist/openapi.swagger2.yaml
```

---

## 📁 Estructura generada por la modularización

```
src/
  main.yaml
  components/
    schemas/*.yaml
    responses/*.yaml
    requestBodies/*.yaml
    parameters/*.yaml
    ...
  paths/
    users.yaml
    users-id.yaml
    ...

dist/
  openapi.yaml            (bundle final)
  api.md                  (documentación Markdown)
  openapi.swagger2.yaml   (si se genera downgrade)
```

---

## ⚙ Requisitos

* Node.js 16+ (recomendado: 18+)
* No requiere instalar Redocly ni Widdershins en los proyectos donde se usa

---

## 🤝 Contribuir

1. Haz un fork del repositorio
2. Crea una rama con tu mejora
3. Envía un Pull Request describiendo el cambio

---

## 📄 Licencia

MIT License

---

## ✨ Autor

**API Factory**
Herramientas modernas para el diseño, documentación y automatización de APIs.

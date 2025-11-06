
# 📦 oas3-modularize: Modularizador y Validador OpenAPI 3

Esta herramienta es un script Node.js diseñado para tomar un único archivo de especificación OpenAPI 3 (OAS3) monolítico (por ejemplo, `swagger.yaml`) y descomponerlo automáticamente en una estructura modular de múltiples archivos.

La modularización utiliza referencias relativas (`$ref`) para dividir rutas (`paths`) y componentes (`components`) en archivos separados (dentro de un directorio `src`), lo que facilita la gestión y el mantenimiento de contratos API grandes.

Además, el script utiliza **Redocly CLI** para validar la nueva estructura modular, asegurando que todas las referencias relativas sean correctas.

## ⚙️ Instalación

### 1. Requisitos

Asegúrate de tener instalado [Node.js](https://nodejs.org/ "null") (versión 14 o superior) y [pnpm](https://pnpm.io/ "null") como tu gestor de paquetes.

### 2. Inicializar el Proyecto

Si aún no tienes un archivo `package.json`, inicializa tu proyecto:

```
pnpm init


```

### 3. Instalar Dependencias

El script requiere las siguientes bibliotecas para su funcionamiento:

1.  **`commander`**: Para manejar los argumentos de línea de comandos.
    
2.  **`js-yaml`**: Para leer y escribir archivos YAML.
    
3.  **`@redocly/cli`**: La herramienta de validación que asegura la integridad de la estructura.
    

Instala las dependencias de producción usando pnpm:

```
pnpm install commander js-yaml @redocly/cli


```

## 🚀 Uso del Script

### Sintaxis

El script `oas3-modularize.js` toma la ruta a tu archivo OAS3 monolítico como argumento obligatorio usando la opción `--build`.

```
node oas3-modularize.js --build <ruta/a/tu/archivo.yaml>


```

### Ejemplo

Si tu archivo original se llama `example.yaml` y está en la raíz de tu proyecto, ejecútalo así:

```
node oas3-modularize.js --build "./example.yaml"


```

### Flujo de Trabajo

Al ejecutar el script, ocurrirá lo siguiente:

1.  **Limpieza:** Si el directorio `src/` existe, será eliminado.
    
2.  **Generación:** Se crearán los directorios `src/`, `src/components/`, y `src/paths/`.
    
3.  **Descomposición:**
    
    -   Todos los objetos dentro de `components` se escribirán en archivos YAML separados dentro de `src/components/` (ej: `schemas.yaml`, `requestBodies.yaml`).
        
    -   Cada ruta individual se escribirá en su propio archivo YAML dentro de `src/paths/` (ej: `users-id.yaml`).
        
4.  **Referencias Fix:** Las referencias (`$ref`) en los archivos modulares se corregirán automáticamente para ser relativas (ej: de `# /components/schemas/Pet` a `./schemas.yaml#/Pet`).
    
5.  **Principal:** Se creará el archivo principal `src/openapi.yaml`, que solo contendrá referencias a los archivos modulares.
    
6.  **Validación:** Se ejecutará `pnpm redocly lint src/openapi.yaml` (o el equivalente de Node si estás usando `node oas3-modularize.js`) para asegurar que la nueva estructura modular sea válida según las reglas de OpenAPI y Redocly.
    

## 📂 Estructura de Salida

El script generará la siguiente estructura de archivos dentro del directorio `src`:

```
src/
├── openapi.yaml          <-- Archivo OAS principal (contiene solo $refs a paths y components)
├── components/
│   ├── schemas.yaml      <-- Todos los objetos de schemas
│   ├── requestBodies.yaml<-- Todos los objetos de requestBodies
│   └── ...
└── paths/
    ├── pet.yaml          <-- Objeto para la ruta /pet
    ├── user-id.yaml      <-- Objeto para la ruta /user/{id}
    └── ...


```
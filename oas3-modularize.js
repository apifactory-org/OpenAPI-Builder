#!/usr/bin/env node

const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { exec } = require('child_process');
const { promisify } = require('util');

const execPromise = promisify(exec);

// --- Configuración ---
const TARGET_DIR = 'src';
const COMPONENTS_DIR = path.join(TARGET_DIR, 'components');
const PATHS_DIR = path.join(TARGET_DIR, 'paths');
// Nombre estándar para que Redocly lo detecte automáticamente
const MAIN_FILE = path.join(TARGET_DIR, 'openapi.yaml'); 

// --- Utilidades ---

/**
 * Escribe contenido como YAML en una ruta específica.
 * @param {string} filePath - La ruta del archivo de salida.
 * @param {object} content - El objeto JavaScript a serializar en YAML.
 */
function writeYamlFile(filePath, content) {
    const yamlContent = yaml.dump(content, { indent: 2, lineWidth: 80 });
    fs.writeFileSync(filePath, yamlContent, 'utf8');
    console.log(`✅ Creado: ${filePath}`);
}

/**
 * Convierte una ruta OAS3 (ej: '/users/{id}') en un nombre de archivo seguro (ej: 'users-id.yaml').
 * @param {string} routePath - La ruta OAS3.
 * @returns {string} - El nombre del archivo YAML.
 */
function slugifyPath(routePath) {
    // 1. Reemplaza barras por guiones
    let slug = routePath.replace(/\//g, '-');
    // 2. Elimina corchetes de parámetros y el guion inicial si existe
    slug = slug.replace(/[{}]/g, '').replace(/^-/, '');
    // 3. Si queda vacío (solo era '/'), usa 'root'
    if (slug === '') return 'root';
    return `${slug}.yaml`;
}

/**
 * Corrige los $ref dentro de un objeto OpenAPI, transformándolos a rutas relativas correctas
 * en función de si el contenido es un Path o un Componente.
 * @param {object} content - El objeto JSON/YAML a procesar.
 * @param {string} componentType - El tipo de componente que estamos procesando (ej: 'schemas', 'requestBodies', o 'paths').
 * @returns {object} El objeto con las referencias corregidas.
 */
function fixRefs(content, componentType) {
    // Convertir a string para usar expresiones regulares, es más eficiente que la recursión profunda
    let contentString = JSON.stringify(content);

    // 1. Corregir referencias DENTRO de archivos de Componentes (schemas.yaml)
    if (componentType === 'schemas') {
        // FIX 1: Referencias INTERNAS en schemas.yaml (ej: Pet referencia a Category)
        // Original: "#/components/schemas/Category"
        // Reemplazo: "#/Category" (relativo a la raíz del propio archivo schemas.yaml)
        contentString = contentString.replace(
            /"#\/components\/schemas\/([^"]+)"/g, 
            (match, componentName) => {
                return `"#/${componentName}"`; 
            }
        );
    }
    
    // 2. Corregir referencias de Componentes a otros Componentes (requestBodies.yaml -> schemas.yaml)
    else if (['requestBodies', 'responses', 'securitySchemes', 'parameters', 'examples'].includes(componentType)) {
         // FIX 2: Referencias de OTROS componentes a SCHEMAS
         // Original: "#/components/schemas/Pet"
         // Reemplazo: "./schemas.yaml#/Pet" (relativo a la ubicación actual dentro de /components/)
         contentString = contentString.replace(
            /"#\/components\/schemas\/([^"]+)"/g, 
            (match, componentName) => {
                return `"./schemas.yaml#/${componentName}"`;
            }
        );
         // FIX 2b: Si un componente hace referencia a otro componente del mismo tipo (menos común, pero manejado).
         contentString = contentString.replace(
            new RegExp(`"#\/components\/${componentType}\/([^"]+)"`, 'g'), 
            (match, componentName) => {
                return `"./${componentType}.yaml#/${componentName}"`;
            }
        );
    }

    // 3. Corregir referencias DENTRO de archivos de Paths
    else if (componentType === 'paths') {
        // FIX 3: Referencias EXTERNAS de Paths a Components 
        // Original: "#/components/schemas/Pet" o "#/components/requestBodies/Pet"
        // Reemplazo: "../openapi.yaml#/components/schemas/Pet"
         contentString = contentString.replace(
            /"#\/components\/(.*?)"/g, 
            `"../openapi.yaml#/components/$1"`
        );
    }

    // Devolver el objeto JavaScript corregido
    return JSON.parse(contentString);
}


// --- Lógica de Validación ---

/**
 * Llama a Redocly CLI para lint/validar la especificación modular generada.
 * @param {string} filePath - Ruta al archivo OAS principal (ej: src/openapi.yaml).
 */
async function validateWithRedocly(filePath) {
    console.log('\n🔍 Ejecutando Validación con Redocly (Linting) sobre la nueva estructura...');
    
    const binDir = path.join('node_modules', '.bin');
    let executableName = 'redocly';
    
    // Usar .cmd en Windows
    if (process.platform === 'win32') {
        executableName = 'redocly.cmd'; 
    }
    
    const redoclyPath = path.join(binDir, executableName); 
    const command = `${redoclyPath} lint ${filePath}`;

    try {
        const { stdout } = await execPromise(command, { cwd: process.cwd(), shell: true });
        
        // Si Redocly tiene éxito (código de salida 0)
        if (stdout.includes('validates successfully') || stdout.includes('No problems found!')) {
            console.log('✅ La estructura modular fue validada exitosamente por Redocly.');
            // Muestra advertencias si existen
            if (!stdout.includes('No problems found!')) {
                console.log('--- Advertencias de Redocly ---');
                const warnings = stdout.split('\n').filter(line => line.includes('Warning was generated by the'));
                if (warnings.length > 0) {
                     warnings.forEach(w => console.log(w.trim()));
                }
                console.log('------------------------------');
            }

        } else {
             // Este caso es un fallback, si stdout no contiene éxito pero no falló el proceso
             console.log(stdout); 
        }

    } catch (error) {
        // Redocly arroja un error (código de salida no cero) si encuentra errores o advertencias graves.
        console.error('\n❌ ERROR CRÍTICO DE VALIDACIÓN EN REDOCLY:');
        
        const validationReport = error.stdout || error.message; 
        
        console.error('╔════════════════════════════════════════════════════════════════════════╗');
        console.error('║                      REPORTE DETALLADO DE VALIDACIÓN REDOCLY           ║');
        console.error('╚════════════════════════════════════════════════════════════════════════╝');
        // Imprimimos el reporte de validación completo
        console.error(validationReport.trim());
        console.error('══════════════════════════════════════════════════════════════════════════');
        
        // Manejo de error de sistema (ej. Redocly no instalado)
        if (validationReport.includes('no se reconoce como un comando interno')) {
             console.error(`Error de Sistema: No se pudo ejecutar el binario en la ruta ${redoclyPath}.`);
             console.log('\nℹ️ SUGERENCIA: Asegúrate de que todas las dependencias estén instaladas. Ejecuta "npm install" y verifica que la carpeta "node_modules" exista.');
        } 
        
        console.log(`\n🚨 ¡FALLO EN LA VALIDACIÓN! El archivo modularizado ${filePath} NO es válido según Redocly.`);
    }
}


// --- Lógica Principal ---

/**
 * Descompone el contrato OAS3.
 * @param {string} inputPath - Ruta al archivo OAS3 de entrada.
 */
async function modularize(inputPath) {
    console.log('----------------------------------------------------');
    try {
        console.log(`🚀 Iniciando modularización de: ${inputPath}`);

        // 1. Verificar y cargar el archivo
        if (!fs.existsSync(inputPath)) {
            throw new Error(`El archivo de entrada no se encontró en: ${inputPath}.`);
        }
        const fileContent = fs.readFileSync(inputPath, 'utf8');
        const oasData = yaml.load(fileContent);

        // 2. Limpiar y Crear directorios
        if (fs.existsSync(TARGET_DIR)) {
            fs.rmSync(TARGET_DIR, { recursive: true, force: true });
            console.log(`🗑️ Directorio existente eliminado: ${TARGET_DIR}`);
        }

        fs.mkdirSync(COMPONENTS_DIR, { recursive: true });
        fs.mkdirSync(PATHS_DIR, { recursive: true });
        console.log(`📂 Directorios creados en: ${TARGET_DIR}`);

        // Inicializar el nuevo objeto OAS principal
        const newOas = {
            openapi: oasData.openapi,
            info: oasData.info,
            servers: oasData.servers || [],
            security: oasData.security || [],
            tags: oasData.tags || [],
            paths: {},
            components: {}
        };

        // 3. Modularizar Components
        const components = oasData.components || {};
        
        console.log('\n📦 Descomponiendo Componentes:');
        for (const [key, content] of Object.entries(components)) {
            // Solo procesamos si el componente tiene contenido
            if (content && Object.keys(content).length > 0) {
                const componentFileName = `${key}.yaml`;
                const componentFilePath = path.join(COMPONENTS_DIR, componentFileName);
                
                // CORRECCIÓN DE REFERENCIAS INTERNAS
                const fixedContent = fixRefs(content, key);
                
                writeYamlFile(componentFilePath, fixedContent);
                
                // Agregar la referencia al nuevo objeto OAS principal
                newOas.components[key] = {
                    $ref: `./components/${componentFileName}`
                };
            }
        }
        
        // 4. Modularizar Paths
        const originalPaths = oasData.paths || {};

        console.log('\n🗺️ Descomponiendo Paths:');
        for (const [routePath, pathObject] of Object.entries(originalPaths)) {
            // VALIDACIÓN AÑADIDA: Asegurar que el objeto de ruta no esté vacío.
            if (pathObject && Object.keys(pathObject).length > 0) {
                const pathFileName = slugifyPath(routePath);
                const pathFilePath = path.join(PATHS_DIR, pathFileName);

                // CORRECCIÓN DE REFERENCIAS EXTERNAS
                const fixedPathObject = fixRefs(pathObject, 'paths');

                // Escribir el contenido de la ruta (el objeto de operaciones, no la clave de la ruta)
                writeYamlFile(pathFilePath, fixedPathObject);

                // Agregar la referencia al nuevo objeto OAS principal
                newOas.paths[routePath] = {
                    $ref: `./paths/${pathFileName}`
                };
            } else {
                console.log(`⚠️ Advertencia: La ruta '${routePath}' fue ignorada porque está vacía.`);
            }
        }

        // 5. Escribir el archivo principal (openapi.yaml)
        console.log('\n📝 Escribiendo Archivo Principal:');
        writeYamlFile(MAIN_FILE, newOas);
        
        // 6. Validar con Redocly CLI
        await validateWithRedocly(MAIN_FILE);

        console.log('\n----------------------------------------------------');
        console.log(`✨ ¡Modularización completada exitosamente en el directorio './${TARGET_DIR}'!`);
        console.log('----------------------------------------------------');

    } catch (error) {
        // Manejo de errores generales
        console.error('----------------------------------------------------');
        console.error(`❌ ERROR al procesar el archivo: ${error.message}`);
        console.error('----------------------------------------------------');
        process.exit(1);
    }
}

// --- Configuración de Commander ---
program
    .name('oas3-modularize')
    .version('1.0.0')
    .description('Decomposes a single OAS3 YAML file into a modular structure using $ref, and validates the output with Redocly CLI.')
    .requiredOption('--build <file>', 'Path to the single input OpenAPI YAML file (e.g., ./miswagger.yaml)')
    .action((options) => {
        modularize(options.build);
    });

program.parse(process.argv);
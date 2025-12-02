// bin/interface/menu.js

/**
 * @fileoverview CLI moderna para OpenAPI Builder usando Prompts + Chalk
 */

const prompts = require('prompts');
const chalk = require('chalk');

// --- Importaciones de Lógica de Negocio ---
const { loadAllConfigs } = require("../infrastructure/configLoader");
const { modularize, MAIN_FILE } = require("../application/modularize");
const { bundleWithRedocly } = require("../application/bundle");
const { generateMarkdownDocs } = require("../application/docs");
const {
    downgradeToSwagger2,
    buildDefaultSwagger2Output,
} = require("../application/downgradeSwagger2");

// ---------------------------------------------------------------
// Carga de Configuración
// ---------------------------------------------------------------
const configs = loadAllConfigs();

const C = {
    modularizeInput: configs.modularize?.paths?.input,
    bundleOutput: configs.modularize?.paths?.bundleOutput,
    docsOutput: configs.modularize?.paths?.docsOutput,
    swagger2Input: configs.swagger2?.paths?.input,
    swagger2Output: configs.swagger2?.paths?.output,
};

// ---------------------------------------------------------------
// ESTILOS Y COLORES
// ---------------------------------------------------------------

const styles = {
    header: (text) => chalk.bold.hex('#F58C34')(text),
    success: (text) => chalk.green('✅ ' + text),
    error: (text) => chalk.red('❌ ' + text),
    info: (text) => chalk.cyan('ℹ️  ' + text),
    warn: (text) => chalk.yellow('⚠️  ' + text),
    help: (text) => chalk.dim.italic(text),
    divider: () => chalk.dim('─'.repeat(70)),
    section: (text) => chalk.bold.cyan(text),
    prompt: (text) => chalk.cyan(`  ${text}`),
};

// Configurar prompts con estilos limpios
const promptsConfig = {
    onState: (state) => {
        // Suprimir comportamiento por defecto de prompts
    },
};

/**
 * Imprime un resultado
 */
function printResult(message, type = 'success') {
    const styleMap = {
        success: styles.success,
        error: styles.error,
        info: styles.info,
        warn: styles.warn,
    };
    console.log('\n' + (styleMap[type] || styles.info)(message) + '\n');
}

/**
 * Pausa la ejecución
 */
async function pause() {
    await prompts({
        type: 'confirm',
        name: 'continue',
        message: 'Presiona enter para volver al menú',
        initial: true,
    }, promptsConfig);
}

// ---------------------------------------------------------------
// ACCIONES
// ---------------------------------------------------------------

async function actionModularize() {
    console.log('\n' + styles.divider());
    console.log(styles.section('  MODULARIZAR OAS3.x'));
    console.log(styles.divider());

    const response = await prompts({
        type: 'text',
        name: 'inputPath',
        message: 'Ruta del archivo OAS3.x',
        initial: C.modularizeInput || './api/openapi.yaml',
        validate: (value) => value.trim() !== '' ? true : 'La ruta no puede estar vacía',
    }, promptsConfig);

    if (!response.inputPath) {
        throw new Error('Operación cancelada por el usuario');
    }

    console.log('');
    await modularize(response.inputPath);
}

async function actionBundle() {
    const inputResponse = await prompts({
        type: 'text',
        name: 'inputPath',
        message: 'Archivo modular principal (entrypoint)',
        initial: MAIN_FILE || './api/index.yaml',
        validate: (value) => value.trim() !== '' ? true : 'La ruta no puede estar vacía',
    });

    if (!inputResponse.inputPath) {
        throw new Error('Operación cancelada por el usuario');
    }

    const outputResponse = await prompts({
        type: 'text',
        name: 'outputPath',
        message: 'Ruta de salida del Bundle',
        initial: C.bundleOutput || './dist/bundle.yaml',
        validate: (value) => value.trim() !== '' ? true : 'La ruta no puede estar vacía',
    });

    if (!outputResponse.outputPath) {
        throw new Error('Operación cancelada por el usuario');
    }

    await bundleWithRedocly(inputResponse.inputPath, outputResponse.outputPath);
    printResult('Bundle consolidado exitosamente', 'success');
}

async function actionDocs() {
    const exampleBundle = C.bundleOutput || './dist/bundle.yaml';

    const inputResponse = await prompts({
        type: 'text',
        name: 'inputPath',
        message: 'Archivo OAS3.x de entrada (Bundle)',
        initial: exampleBundle,
        validate: (value) => value.trim() !== '' ? true : 'La ruta no puede estar vacía',
    });

    if (!inputResponse.inputPath) {
        throw new Error('Operación cancelada por el usuario');
    }

    const outputResponse = await prompts({
        type: 'text',
        name: 'outputPath',
        message: 'Ruta de salida del Markdown',
        initial: C.docsOutput || './docs/api.md',
        validate: (value) => value.trim() !== '' ? true : 'La ruta no puede estar vacía',
    });

    if (!outputResponse.outputPath) {
        throw new Error('Operación cancelada por el usuario');
    }

    await generateMarkdownDocs(inputResponse.inputPath, outputResponse.outputPath);
    printResult('Documentación generada exitosamente', 'success');
}

async function actionExportSwagger2() {
    const exampleInput = C.swagger2Input || C.bundleOutput || './dist/bundle.yaml';

    const inputResponse = await prompts({
        type: 'text',
        name: 'inputPath',
        message: 'Bundle OAS3.x de entrada',
        initial: exampleInput,
        validate: (value) => value.trim() !== '' ? true : 'La ruta no puede estar vacía',
    });

    if (!inputResponse.inputPath) {
        throw new Error('Operación cancelada por el usuario');
    }

    const suggestedOutput = C.swagger2Output || buildDefaultSwagger2Output(inputResponse.inputPath);

    const outputResponse = await prompts({
        type: 'text',
        name: 'outputPath',
        message: 'Ruta de salida de Swagger 2.0',
        initial: suggestedOutput || './dist/swagger2.yaml',
        validate: (value) => value.trim() !== '' ? true : 'La ruta no puede estar vacía',
    });

    if (!outputResponse.outputPath) {
        throw new Error('Operación cancelada por el usuario');
    }

    await downgradeToSwagger2(inputResponse.inputPath, outputResponse.outputPath);
    printResult('Exportación a Swagger 2.0 completada', 'success');
}

// ---------------------------------------------------------------
// MENÚ PRINCIPAL
// ---------------------------------------------------------------

const MENU_ACTIONS = [
    {
        id: 1,
        label: 'Modularizar OAS3.x',
        description: 'Divide la especificación OAS3.x en múltiples archivos',
        action: actionModularize,
    },
    {
        id: 2,
        label: 'Consolidar OAS3.x',
        description: 'Resuelve referencias y une todos los archivos en un Bundle',
        action: actionBundle,
    },
    {
        id: 3,
        label: 'Generar Documentación',
        description: 'Genera documentación Markdown desde el Bundle',
        action: actionDocs,
    },
    {
        id: 4,
        label: 'Exportar a Swagger 2.0',
        description: 'Convierte OAS3.x a Swagger 2.0 (downgrade)',
        action: actionExportSwagger2,
    },
];

/**
 * Muestra el menú principal y ejecuta acciones
 */
async function showMenu() {
    console.clear();
    console.log('\n' + styles.divider());
    console.log(styles.header('  OpenAPI Builder CLI v1.0.7'));
    console.log(styles.divider() + '\n');

    // Mostrar opciones enumeradas
    console.log(chalk.bold('Selecciona una acción:\n'));
    MENU_ACTIONS.forEach((action, index) => {
        console.log(
            chalk.cyan(`  ${action.id}) ${action.label}`)
        );
        console.log(
            styles.help(`     ${action.description}`)
        );
    });
    console.log(chalk.red(`  5) Salir`));
    console.log(styles.help(`     Cierra la aplicación\n`));

    // Solicitar número de opción
    const response = await prompts({
        type: 'number',
        name: 'action',
        message: 'Ingresa el número de la acción',
        initial: 1,
        validate: (value) => {
            if (isNaN(value) || value < 1 || value > 5) {
                return 'Ingresa un número entre 1 y 5';
            }
            return true;
        },
    }, promptsConfig);

    if (response.action === 5 || !response.action) {
        console.log('\n' + styles.header('👋 ¡Hasta luego!'));
        console.log(styles.divider() + '\n');
        process.exit(0);
    }

    const selectedAction = MENU_ACTIONS.find((a) => a.id === response.action);

    if (selectedAction) {
        try {
            await selectedAction.action();
            printResult('Operación completada exitosamente', 'success');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            printResult(message, 'error');
        }
    }

    // Pausa antes de volver al menú
    await pause();
    await showMenu();
}

/**
 * Inicia la aplicación
 */
async function startApplication() {
    try {
        await showMenu();
    } catch (error) {
        console.error(styles.error(String(error)));
        process.exit(1);
    }
}

module.exports = {
    showMenu,
    startApplication,
};
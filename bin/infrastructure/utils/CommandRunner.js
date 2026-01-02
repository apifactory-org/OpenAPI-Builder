// bin/infrastructure/utils/CommandRunner.js
const { exec } = require('child_process');
const { promisify } = require('util');

const execPromise = promisify(exec);

/**
 * Servicio: Ejecución de comandos shell
 */
class CommandRunner {
  /**
   * Ejecuta un comando y devuelve stdout/stderr
   */
  async run(command) {
    try {
      return await execPromise(command, {
        cwd: process.cwd(),
        shell: true,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });
    } catch (error) {
      // ✅ Mejorar mensaje de error
      const errorMessage = [
        `Command failed: ${command}`,
        error.stdout ? `\nStdout: ${error.stdout}` : '',
        error.stderr ? `\nStderr: ${error.stderr}` : '',
        error.message ? `\nError: ${error.message}` : '',
      ].filter(Boolean).join('\n');
      
      const enhancedError = new Error(errorMessage);
      enhancedError.code = error.code;
      enhancedError.stdout = error.stdout;
      enhancedError.stderr = error.stderr;
      
      throw enhancedError;
    }
  }
}

module.exports = { CommandRunner };
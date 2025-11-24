// bin/infrastructure/runCommand.js

const { exec } = require('child_process');
const { promisify } = require('util');

const execPromise = promisify(exec);

/**
 * Ejecuta un comando de shell y devuelve stdout/stderr.
 *
 * @param {string} command
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
async function runCommand(command) {
  return execPromise(command, {
    cwd: process.cwd(),
    shell: true,
  });
}

module.exports = {
  runCommand,
};

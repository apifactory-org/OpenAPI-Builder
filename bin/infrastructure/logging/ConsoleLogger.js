// bin/infrastructure/logging/ConsoleLogger.js

const chalk = require('chalk');
const { ILogger } = require('../../application/ports/ILogger');

/**
 * Adapter: Logger para consola con colores
 */
class ConsoleLogger extends ILogger {
  constructor(config = {}) {
    super();
    this.level = config.level || 'info';
    this.prefix = config.prefix || '';
    
    this.levels = {
      silent: 0,
      error: 1,
      warn: 2,
      info: 3,
      debug: 4
    };
  }

  debug(message, context = {}) {
    this.log('debug', chalk.gray(message), context);
  }

  info(message, context = {}) {
    this.log('info', chalk.cyan(message), context);
  }

  warn(message, context = {}) {
    this.log('warn', chalk.yellow(message), context);
  }

  error(message, error, context = {}) {
    const fullMessage = error ? `${message}: ${error.message}` : message;
    this.log('error', chalk.red(fullMessage), context);
    
    if (error && error.stack) {
      console.error(chalk.red(error.stack));
    }
  }

  section(title) {
    if (this.shouldLog('info')) {
      console.log('\n' + chalk.dim('-'.repeat(70)));
      console.log(chalk.bold.cyan(`  ${title}`));
      console.log(chalk.dim('-'.repeat(70)));
    }
  }

  step(message) {
    if (this.shouldLog('info')) {
      console.log(chalk.cyan('  → ') + message);
    }
  }

  success(message) {
    if (this.shouldLog('info')) {
      console.log(chalk.green('  ✓ ') + message);
    }
  }

  log(level, message, context) {
    if (this.shouldLog(level)) {
      const prefix = this.prefix ? chalk.magenta(`[${this.prefix}] `) : '';
      console.log(prefix + message);
      
      if (Object.keys(context).length > 0) {
        console.log(chalk.gray('    Context:'), context);
      }
    }
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.level];
  }

  setLevel(level) {
    if (this.levels[level] !== undefined) {
      this.level = level;
    }
  }
}

module.exports = { ConsoleLogger };
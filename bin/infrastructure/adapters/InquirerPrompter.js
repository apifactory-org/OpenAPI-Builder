// bin/infrastructure/adapters/InquirerPrompter.js

const prompts = require('prompts');
const { IPrompter } = require('../../application/ports/IPrompter');

/**
 * Adapter: Prompter usando prompts
 */
class InquirerPrompter extends IPrompter {
  async confirm(message, defaultValue = false) {
    const response = await prompts({
      type: 'confirm',
      name: 'value',
      message,
      initial: defaultValue
    });

    if (response.value === undefined) {
      throw new Error('Operación cancelada por el usuario');
    }

    return response.value;
  }

  async text(message, defaultValue = '') {
    const response = await prompts({
      type: 'text',
      name: 'value',
      message,
      initial: defaultValue,
      validate: value => value.trim() !== '' ? true : 'No puede estar vacío'
    });

    if (response.value === undefined) {
      throw new Error('Operación cancelada por el usuario');
    }

    return response.value;
  }

  async select(message, choices) {
    const response = await prompts({
      type: 'select',
      name: 'value',
      message,
      choices: choices.map(c => ({
        title: c.title,
        value: c.value
      }))
    });

    if (response.value === undefined) {
      throw new Error('Operación cancelada por el usuario');
    }

    return response.value;
  }

  async number(message, initial = 1, min = 1, max = 100) {
    const response = await prompts({
      type: 'number',
      name: 'value',
      message,
      initial,
      min,
      max,
      validate: value => {
        if (isNaN(value) || value < min || value > max) {
          return `Ingresa un número entre ${min} y ${max}`;
        }
        return true;
      }
    });

    if (response.value === undefined) {
      throw new Error('Operación cancelada por el usuario');
    }

    return response.value;
  }
}

module.exports = { InquirerPrompter };
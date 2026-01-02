// bin/domain/entities/Component.js

/**
 * Entity: Representa un componente reutilizable de OpenAPI
 */
class Component {
  constructor(name, type, content) {
    this.name = name;
    this.type = type; // schemas, responses, requestBodies, etc.
    this.content = content;
  }

  getName() {
    return this.name;
  }

  getType() {
    return this.type;
  }

  getContent() {
    return this.content;
  }

  hasReference() {
    return !!this.content.$ref;
  }

  isInline() {
    return !this.hasReference();
  }

  toJSON() {
    return this.content;
  }
}

module.exports = { Component };
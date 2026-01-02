// bin/interface/cli/DependencyContainer.js

const { ConfigLoader } = require('../../infrastructure/config/ConfigLoader');
const { ConsoleLogger } = require('../../infrastructure/logging/ConsoleLogger');
const { ExecutableResolver } = require('../../infrastructure/utils/ExecutableResolver');
const { CommandRunner } = require('../../infrastructure/utils/CommandRunner');

// Adapters
const { YamlDocumentRepository } = require('../../infrastructure/adapters/YamlDocumentRepository');
const { RedoclyBundler } = require('../../infrastructure/adapters/RedoclyBundler');
const { RedoclyValidator } = require('../../infrastructure/adapters/RedoclyValidator');
const { WiddershinsDocGenerator } = require('../../infrastructure/adapters/WiddershinsDocGenerator');
const { ApiSpecConverterDowngrader } = require('../../infrastructure/adapters/ApiSpecConverterDowngrader');
const { InquirerPrompter } = require('../../infrastructure/adapters/InquirerPrompter');

// Domain Services
const { NameNormalizerService } = require('../../domain/services/NameNormalizerService');
const { ResponseExtractorService } = require('../../domain/services/ResponseExtractorService');
const { ResponseDeduplicatorService } = require('../../domain/services/ResponseDeduplicatorService');
const { ReferenceFixerService } = require('../../domain/services/ReferenceFixerService');
const { ComponentSplitterService } = require('../../domain/services/ComponentSplitterService');
const { ParameterExtractorService } = require('../../domain/services/ParameterExtractorService');

// 🆕 Nuevos Domain Services
const { ModularizationModelBuilder } = require('../../domain/services/ModularizationModelBuilder');
const { ReferenceResolver } = require('../../domain/services/ReferenceResolver');
const { ModelValidator } = require('../../domain/services/ModelValidator');

// 🆕 Nuevo Infrastructure Adapter
const { ModularizationWriter } = require('../../infrastructure/adapters/ModularizationWriter');

// Use Cases
const { ModularizeUseCase } = require('../../application/use-cases/ModularizeUseCase');
const { BundleUseCase } = require('../../application/use-cases/BundleUseCase');
const { GenerateDocsUseCase } = require('../../application/use-cases/GenerateDocsUseCase');
const { DowngradeSwagger2UseCase } = require('../../application/use-cases/DowngradeSwagger2UseCase');

/**
 * Contenedor de Inyección de Dependencias
 */
class DependencyContainer {
  constructor() {
    this.instances = {};
    this.config = null;

    // Cache de configuración modularize para consistencia
    this.modularizeConfig = null;
  }

  /**
   * Inicializa el contenedor
   */
  initialize() {
    // Cargar configuración
    this.config = this.getConfigLoader().loadAll();

    // Cachear config modularize para evitar lecturas inconsistentes
    this.modularizeConfig = this.config.modularize || {};

    // Configurar logger
    const loggingConfig = this.config.logging || {};
    this.getLogger().setLevel(loggingConfig.level || 'info');
  }

  /**
   * Obtiene configuración
   */
  getConfig() {
    if (!this.config) {
      this.config = this.getConfigLoader().loadAll();
      this.modularizeConfig = this.config.modularize || {};
    }
    return this.config;
  }

  getModularizeConfig() {
    if (!this.modularizeConfig) {
      this.modularizeConfig = this.getConfig().modularize || {};
    }
    return this.modularizeConfig;
  }

  // ==================== INFRASTRUCTURE ====================

  getConfigLoader() {
    if (!this.instances.configLoader) {
      this.instances.configLoader = new ConfigLoader();
    }
    return this.instances.configLoader;
  }

  getLogger() {
    if (!this.instances.logger) {
      const config = this.getConfig().logging || {};
      this.instances.logger = new ConsoleLogger(config);
    }
    return this.instances.logger;
  }

  getExecutableResolver() {
    if (!this.instances.executableResolver) {
      this.instances.executableResolver = new ExecutableResolver();
    }
    return this.instances.executableResolver;
  }

  getCommandRunner() {
    if (!this.instances.commandRunner) {
      this.instances.commandRunner = new CommandRunner();
    }
    return this.instances.commandRunner;
  }

  getDocumentRepository() {
    if (!this.instances.documentRepository) {
      this.instances.documentRepository = new YamlDocumentRepository(
        this.getLogger()
      );
    }
    return this.instances.documentRepository;
  }

  getBundler() {
    if (!this.instances.bundler) {
      this.instances.bundler = new RedoclyBundler(
        this.getExecutableResolver(),
        this.getCommandRunner(),
        this.getDocumentRepository(),
        this.getLogger()
      );
    }
    return this.instances.bundler;
  }

  getValidator() {
    if (!this.instances.validator) {
      this.instances.validator = new RedoclyValidator(
        this.getExecutableResolver(),
        this.getCommandRunner(),
        this.getLogger()
      );
    }
    return this.instances.validator;
  }

  getDocGenerator() {
    if (!this.instances.docGenerator) {
      this.instances.docGenerator = new WiddershinsDocGenerator(
        this.getExecutableResolver(),
        this.getCommandRunner(),
        this.getLogger()
      );
    }
    return this.instances.docGenerator;
  }

  getDowngrader() {
    if (!this.instances.downgrader) {
      this.instances.downgrader = new ApiSpecConverterDowngrader(
        this.getExecutableResolver(),
        this.getCommandRunner(),
        this.getLogger()
      );
    }
    return this.instances.downgrader;
  }

  getPrompter() {
    if (!this.instances.prompter) {
      this.instances.prompter = new InquirerPrompter();
    }
    return this.instances.prompter;
  }

  // 🆕 Nuevo Adapter: ModularizationWriter
  getModularizationWriter() {
    if (!this.instances.modularizationWriter) {
      this.instances.modularizationWriter = new ModularizationWriter(
        this.getDocumentRepository(),
        this.getLogger()
      );
    }
    return this.instances.modularizationWriter;
  }

  // ==================== DOMAIN SERVICES ====================

  getNameNormalizerService() {
    if (!this.instances.nameNormalizer) {
      this.instances.nameNormalizer = new NameNormalizerService();
    }
    return this.instances.nameNormalizer;
  }

  getResponseExtractorService() {
    if (!this.instances.responseExtractor) {
      const config = this.getModularizeConfig();
      this.instances.responseExtractor = new ResponseExtractorService(
        this.getNameNormalizerService(),
        config.responseNaming || {}
      );
    }
    return this.instances.responseExtractor;
  }

  getResponseDeduplicatorService() {
    if (!this.instances.responseDeduplicator) {
      const config = this.getModularizeConfig();
      const responseConfig = { ...(config.responseNaming || {}) };

      // Garantizar que namingConvention se derive de config.naming.components
      responseConfig.namingConvention = config.naming?.components;

      this.instances.responseDeduplicator = new ResponseDeduplicatorService(
        this.getNameNormalizerService(),
        responseConfig
      );
    }
    return this.instances.responseDeduplicator;
  }

  getReferenceFixerService() {
    if (!this.instances.referenceFixer) {
      this.instances.referenceFixer = new ReferenceFixerService(
        this.getNameNormalizerService()
      );
    }
    return this.instances.referenceFixer;
  }

  getComponentSplitterService() {
    if (!this.instances.componentSplitter) {
      this.instances.componentSplitter = new ComponentSplitterService(
        this.getNameNormalizerService(),
        this.getReferenceFixerService()
      );
    }
    return this.instances.componentSplitter;
  }

  getParameterExtractorService() {
    if (!this.instances.parameterExtractor) {
      this.instances.parameterExtractor = new ParameterExtractorService(
        this.getModularizeConfig()
      );
    }
    return this.instances.parameterExtractor;
  }

  // 🆕 Nuevos Domain Services

  getModularizationModelBuilder() {
    if (!this.instances.modularizationModelBuilder) {
      this.instances.modularizationModelBuilder = new ModularizationModelBuilder(
        this.getNameNormalizerService(),
        this.getLogger()
      );
    }
    return this.instances.modularizationModelBuilder;
  }

  getReferenceResolver() {
    if (!this.instances.referenceResolver) {
      this.instances.referenceResolver = new ReferenceResolver(
        this.getLogger()
      );
    }
    return this.instances.referenceResolver;
  }

  getModelValidator() {
    if (!this.instances.modelValidator) {
      this.instances.modelValidator = new ModelValidator(
        this.getLogger()
      );
    }
    return this.instances.modelValidator;
  }

  // ==================== USE CASES ====================

  getModularizeUseCase() {
    if (!this.instances.modularizeUseCase) {
      this.instances.modularizeUseCase = new ModularizeUseCase(
        this.getDocumentRepository(),
        this.getValidator(),
        this.getLogger(),
        this.getPrompter(),
        this.getNameNormalizerService(),
        this.getResponseExtractorService(),
        this.getResponseDeduplicatorService(),
        this.getParameterExtractorService(),
        // 🆕 Nuevas dependencias
        this.getModularizationModelBuilder(),
        this.getReferenceResolver(),
        this.getModelValidator(),
        this.getModularizationWriter()
      );
    }
    return this.instances.modularizeUseCase;
  }

  getBundleUseCase() {
    if (!this.instances.bundleUseCase) {
      this.instances.bundleUseCase = new BundleUseCase(
        this.getDocumentRepository(),
        this.getBundler(),
        this.getLogger()
      );
    }
    return this.instances.bundleUseCase;
  }

  getGenerateDocsUseCase() {
    if (!this.instances.generateDocsUseCase) {
      this.instances.generateDocsUseCase = new GenerateDocsUseCase(
        this.getDocumentRepository(),
        this.getDocGenerator(),
        this.getLogger()
      );
    }
    return this.instances.generateDocsUseCase;
  }

  getDowngradeSwagger2UseCase() {
    if (!this.instances.downgradeSwagger2UseCase) {
      this.instances.downgradeSwagger2UseCase = new DowngradeSwagger2UseCase(
        this.getDocumentRepository(),
        this.getDowngrader(),
        this.getLogger()
      );
    }
    return this.instances.downgradeSwagger2UseCase;
  }
}

module.exports = { DependencyContainer };
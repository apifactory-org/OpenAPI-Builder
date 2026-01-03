// tests/unit/domain/services/ParameterExtractorService.test.js

const { ParameterExtractorService } = require('../../../../bin/domain/services/ParameterExtractorService');

describe('ParameterExtractorService', () => {
  let service;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      success: jest.fn()
    };
    service = new ParameterExtractorService(mockLogger, 2);
  });

  describe('Parámetros con mismo nombre pero diferente ubicación', () => {
    it('debe generar nombres únicos para username en query y path', () => {
      const openApiDoc = {
        paths: {
          '/user/login': {
            get: {
              parameters: [
                {
                  name: 'username',
                  in: 'query',
                  description: 'Username for login',
                  schema: { type: 'string' }
                }
              ]
            }
          },
          '/user/{username}': {
            get: {
              parameters: [
                {
                  name: 'username',
                  in: 'path',
                  required: true,
                  description: 'Username to fetch',
                  schema: { type: 'string' }
                }
              ]
            },
            put: {
              parameters: [
                {
                  name: 'username',
                  in: 'path',
                  required: true,
                  description: 'Username to update',
                  schema: { type: 'string' }
                }
              ]
            }
          }
        }
      };

      const result = service.extract(openApiDoc);

      // Debe crear DOS parámetros con nombres únicos
      expect(Object.keys(result.extractedParams)).toHaveLength(2);
      
      // Nombres deben incluir la ubicación
      expect(result.extractedParams).toHaveProperty('UsernameQueryParam');
      expect(result.extractedParams).toHaveProperty('UsernamePathParam');
      
      // Query param
      expect(result.extractedParams.UsernameQueryParam).toEqual({
        name: 'username',
        in: 'query',
        description: 'Username for login',
        schema: { type: 'string' }
      });
      
      // Path param (aparece 2 veces, debe extraerse)
      expect(result.extractedParams.UsernamePathParam).toEqual({
        name: 'username',
        in: 'path',
        required: true,
        description: 'Username to fetch',
        schema: { type: 'string' }
      });

      // Verificar referencias en paths actualizados
      const loginParams = result.updatedPaths['/user/login'].get.parameters;
      expect(loginParams[0]).toEqual({ 
        $ref: '#/components/parameters/UsernameQueryParam' 
      });

      const getUserParams = result.updatedPaths['/user/{username}'].get.parameters;
      expect(getUserParams[0]).toEqual({ 
        $ref: '#/components/parameters/UsernamePathParam' 
      });
    });

    it('debe generar PetIdPathParam para petId en path', () => {
      const openApiDoc = {
        paths: {
          '/pet/{petId}': {
            get: {
              parameters: [
                {
                  name: 'petId',
                  in: 'path',
                  required: true,
                  schema: { type: 'integer', format: 'int64' }
                }
              ]
            },
            delete: {
              parameters: [
                {
                  name: 'petId',
                  in: 'path',
                  required: true,
                  schema: { type: 'integer', format: 'int64' }
                }
              ]
            }
          }
        }
      };

      const result = service.extract(openApiDoc);

      expect(result.extractedParams).toHaveProperty('PetIdPathParam');
      expect(result.extractedParams.PetIdPathParam.in).toBe('path');
      expect(result.extractedParams.PetIdPathParam.name).toBe('petId');
    });
  });

  describe('Normalización de nombres', () => {
    it('debe convertir snake_case a PascalCase', () => {
      const openApiDoc = {
        paths: {
          '/api/test': {
            get: {
              parameters: [
                {
                  name: 'order_id',
                  in: 'query',
                  schema: { type: 'string' }
                }
              ]
            },
            post: {
              parameters: [
                {
                  name: 'order_id',
                  in: 'query',
                  schema: { type: 'string' }
                }
              ]
            }
          }
        }
      };

      const result = service.extract(openApiDoc);
      
      expect(result.extractedParams).toHaveProperty('OrderIdQueryParam');
    });

    it('debe convertir kebab-case a PascalCase', () => {
      const openApiDoc = {
        paths: {
          '/api/test': {
            get: {
              parameters: [
                {
                  name: 'api-key',
                  in: 'header',
                  schema: { type: 'string' }
                }
              ]
            },
            post: {
              parameters: [
                {
                  name: 'api-key',
                  in: 'header',
                  schema: { type: 'string' }
                }
              ]
            }
          }
        }
      };

      const result = service.extract(openApiDoc);
      
      expect(result.extractedParams).toHaveProperty('ApiKeyHeaderParam');
    });
  });

  describe('Threshold de extracción', () => {
    it('NO debe extraer parámetros que aparecen menos de threshold veces', () => {
      const openApiDoc = {
        paths: {
          '/pet': {
            post: {
              parameters: [
                {
                  name: 'name',
                  in: 'query',
                  schema: { type: 'string' }
                }
              ]
            }
          }
        }
      };

      const result = service.extract(openApiDoc);

      // Solo aparece 1 vez, threshold es 2, NO debe extraerse
      expect(Object.keys(result.extractedParams)).toHaveLength(0);
    });

    it('debe extraer parámetros que aparecen >= threshold veces', () => {
      const openApiDoc = {
        paths: {
          '/pet': {
            get: {
              parameters: [
                {
                  name: 'status',
                  in: 'query',
                  schema: { type: 'string' }
                }
              ]
            },
            post: {
              parameters: [
                {
                  name: 'status',
                  in: 'query',
                  schema: { type: 'string' }
                }
              ]
            }
          }
        }
      };

      const result = service.extract(openApiDoc);

      // Aparece 2 veces, threshold es 2, SÍ debe extraerse
      expect(Object.keys(result.extractedParams)).toHaveLength(1);
      expect(result.extractedParams).toHaveProperty('StatusQueryParam');
    });
  });

  describe('Parámetros con diferentes schemas', () => {
    it('NO debe deduplicar parámetros con mismo nombre e in pero diferente schema', () => {
      const openApiDoc = {
        paths: {
          '/api/v1': {
            get: {
              parameters: [
                {
                  name: 'id',
                  in: 'query',
                  schema: { type: 'string' }
                }
              ]
            },
            post: {
              parameters: [
                {
                  name: 'id',
                  in: 'query',
                  schema: { type: 'string' }
                }
              ]
            }
          },
          '/api/v2': {
            get: {
              parameters: [
                {
                  name: 'id',
                  in: 'query',
                  schema: { type: 'integer' } // Diferente tipo
                }
              ]
            },
            post: {
              parameters: [
                {
                  name: 'id',
                  in: 'query',
                  schema: { type: 'integer' }
                }
              ]
            }
          }
        }
      };

      const result = service.extract(openApiDoc);

      // Debe crear DOS parámetros porque tienen schemas diferentes
      expect(Object.keys(result.extractedParams)).toHaveLength(2);
    });
  });
});
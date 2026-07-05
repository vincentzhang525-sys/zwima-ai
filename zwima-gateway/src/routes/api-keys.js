import { jwtAuth } from '../middleware/jwt-auth.js';
import { createApiKey, listApiKeys, revokeApiKey } from '../services/api-key.service.js';

export default async function apiKeyRoutes(fastify) {
  fastify.addHook('preHandler', jwtAuth);

  fastify.get('/', async (request) => {
    const keys = await listApiKeys(request.user.id);
    return { keys };
  });

  fastify.post('/create', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          env: { type: 'string', enum: ['live', 'test'] },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const key = await createApiKey(request.user.id, {
        name: request.body.name,
        env: request.body.env || 'live',
      });

      return reply.code(201).send({
        id: key.id,
        name: key.name,
        key_prefix: key.key_prefix,
        env: key.env,
        api_key: key.api_key,
        warning: 'Store this key securely. It will not be shown again.',
        created_at: key.created_at,
      });
    } catch (err) {
      return reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });

  fastify.post('/revoke/:id', async (request, reply) => {
    try {
      const result = await revokeApiKey(request.user.id, request.params.id);
      return result;
    } catch (err) {
      return reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });
}

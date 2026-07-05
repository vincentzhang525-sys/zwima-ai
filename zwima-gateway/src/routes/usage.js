import { jwtAuth } from '../middleware/jwt-auth.js';
import { getUsageRecords } from '../services/usage.service.js';

export default async function usageRoutes(fastify) {
  fastify.addHook('preHandler', jwtAuth);

  fastify.get('/', async (request, reply) => {
    const limit = Math.min(parseInt(request.query.limit || '50', 10), 100);
    const offset = parseInt(request.query.offset || '0', 10);

    const result = await getUsageRecords(request.user.id, { limit, offset });
    return result;
  });
}

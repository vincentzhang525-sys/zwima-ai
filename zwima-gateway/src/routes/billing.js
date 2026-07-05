import { jwtAuth } from '../middleware/jwt-auth.js';
import { getBillingRecords } from '../services/billing.service.js';

export default async function billingRoutes(fastify) {
  fastify.addHook('preHandler', jwtAuth);

  fastify.get('/', async (request, reply) => {
    const records = await getBillingRecords(request.user.id);
    return { records };
  });
}

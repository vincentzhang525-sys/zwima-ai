import { jwtAuth } from '../middleware/jwt-auth.js';
import { getCreditBalance, getCreditTransactions } from '../services/credit.service.js';

export default async function accountRoutes(fastify) {
  fastify.addHook('preHandler', jwtAuth);

  fastify.get('/credits', async (request, reply) => {
    try {
      const balance = await getCreditBalance(request.user.id);
      const transactions = await getCreditTransactions(request.user.id, { limit: 20 });
      return { ...balance, transactions };
    } catch (err) {
      return reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });
}

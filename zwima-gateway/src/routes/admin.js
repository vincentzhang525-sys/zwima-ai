import { adminAuth } from '../middleware/admin-auth.js';
import {
  listUsers,
  listAllApiKeys,
  listAllBilling,
  getStats,
} from '../services/admin.service.js';
import { getAllUsageRecords } from '../services/usage.service.js';
import { topupCredits } from '../services/credit.engine.js';
import { createBillingRecord } from '../services/billing.service.js';

export default async function adminRoutes(fastify) {
  fastify.addHook('preHandler', adminAuth);

  fastify.get('/stats', async () => getStats());

  fastify.get('/users', async () => {
    const users = await listUsers();
    return { users };
  });

  fastify.get('/api-keys', async () => {
    const keys = await listAllApiKeys();
    return { keys };
  });

  fastify.get('/usage', async (request) => {
    const limit = Math.min(parseInt(request.query.limit || '100', 10), 500);
    const offset = parseInt(request.query.offset || '0', 10);
    const records = await getAllUsageRecords({ limit, offset });
    return { records };
  });

  fastify.get('/billing', async () => {
    const records = await listAllBilling();
    return { records };
  });

  fastify.post('/credits/topup', {
    schema: {
      body: {
        type: 'object',
        required: ['user_id', 'amount'],
        properties: {
          user_id: { type: 'string' },
          amount: { type: 'integer', minimum: 1 },
          description: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const balance = await topupCredits(
        request.body.user_id,
        request.body.amount,
        request.body.description || 'Admin credit top-up'
      );
      return { credit_balance: balance };
    } catch (err) {
      return reply.code(400).send({ error: err.message });
    }
  });

  fastify.post('/billing/create', {
    schema: {
      body: {
        type: 'object',
        required: ['user_id', 'type', 'amount_eur'],
        properties: {
          user_id: { type: 'string' },
          type: { type: 'string' },
          amount_eur: { type: 'number' },
          period_start: { type: 'string' },
          period_end: { type: 'string' },
          invoice_number: { type: 'string' },
          status: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const record = await createBillingRecord(request.body.user_id, request.body);
      return reply.code(201).send(record);
    } catch (err) {
      return reply.code(400).send({ error: err.message });
    }
  });
}

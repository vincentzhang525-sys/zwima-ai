import { register, login } from '../services/auth.service.js';

export default async function authRoutes(fastify) {
  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['company_name', 'email', 'password'],
        properties: {
          company_name: { type: 'string', minLength: 1 },
          email: { type: 'string', minLength: 3 },
          password: { type: 'string', minLength: 8 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const user = await register({
        companyName: request.body.company_name,
        email: request.body.email,
        password: request.body.password,
      });

      return reply.code(201).send({
        id: user.id,
        company_name: user.company_name,
        email: user.email,
        credit_balance: user.credit_balance,
        monthly_quota: user.monthly_quota,
      });
    } catch (err) {
      return reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });

  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', minLength: 3 },
          password: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const result = await login({
        email: request.body.email,
        password: request.body.password,
      });
      return result;
    } catch (err) {
      return reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });
}

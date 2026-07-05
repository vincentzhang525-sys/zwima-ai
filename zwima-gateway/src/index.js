import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { pool } from './db/index.js';
import authRoutes from './routes/auth.js';
import apiKeyRoutes from './routes/api-keys.js';
import accountRoutes from './routes/account.js';
import chatRoutes from './routes/chat.js';
import usageRoutes from './routes/usage.js';
import billingRoutes from './routes/billing.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fastify = Fastify({ logger: true });

await fastify.register(cors, { origin: true });

fastify.get('/health', async () => ({
  status: 'ok',
  version: '0.1.0',
  mock_openai: config.mockOpenai || !config.openaiApiKey,
}));

await fastify.register(authRoutes, { prefix: '/auth' });
await fastify.register(apiKeyRoutes, { prefix: '/api-keys' });
await fastify.register(accountRoutes, { prefix: '/account' });
await fastify.register(chatRoutes, { prefix: '/v1' });
await fastify.register(usageRoutes, { prefix: '/usage' });
await fastify.register(billingRoutes, { prefix: '/billing' });
await fastify.register(adminRoutes, { prefix: '/admin' });

await fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../admin'),
  prefix: '/admin/',
  decorateReply: false,
});

fastify.get('/admin', async (_req, reply) => reply.redirect('/admin/'));

const start = async () => {
  try {
    await pool.query('SELECT 1');
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`Zwima Gateway V0.1 → http://localhost:${config.port}`);
    console.log(`Admin panel    → http://localhost:${config.port}/admin/`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

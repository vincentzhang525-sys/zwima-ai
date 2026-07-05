import { resolveApiKey } from '../services/api-key.service.js';

export async function apiKeyAuth(request, reply) {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return reply.code(401).send({
      error: {
        message: 'Missing Zwima API key. Use: Authorization: Bearer zwima_sk_live_...',
        type: 'authentication_error',
      },
    });
  }

  const rawKey = header.slice(7);
  const ctx = await resolveApiKey(rawKey);

  if (!ctx) {
    return reply.code(401).send({
      error: {
        message: 'Invalid or revoked API key',
        type: 'authentication_error',
      },
    });
  }

  if (ctx.credit_balance <= 0) {
    return reply.code(429).send({
      error: {
        message: 'Credit quota exceeded',
        type: 'quota_exceeded',
      },
    });
  }

  request.apiContext = ctx;
}

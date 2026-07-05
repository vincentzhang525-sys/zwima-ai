import { apiKeyAuth } from '../middleware/api-key-auth.js';
import { chatCompletion } from '../services/openai.service.js';
import { deductCreditsWithUsage } from '../services/credit.engine.js';

export default async function chatRoutes(fastify) {
  fastify.post('/chat/completions', {
    preHandler: apiKeyAuth,
    schema: {
      body: {
        type: 'object',
        required: ['model', 'messages'],
        properties: {
          model: { type: 'string' },
          messages: { type: 'array' },
          temperature: { type: 'number' },
          max_tokens: { type: 'integer' },
        },
      },
    },
  }, async (request, reply) => {
    const ctx = request.apiContext;
    const body = request.body;

    try {
      const { data, latencyMs } = await chatCompletion(body);

      const inputTokens = data.usage?.prompt_tokens ?? 0;
      const outputTokens = data.usage?.completion_tokens ?? 0;

      await deductCreditsWithUsage({
        userId: ctx.user_id,
        apiKeyId: ctx.api_key_id,
        model: body.model,
        inputTokens,
        outputTokens,
        latencyMs,
        status: 'success',
      });

      return data;
    } catch (err) {
      if (err.statusCode !== 429) {
        await deductCreditsWithUsage({
          userId: ctx.user_id,
          apiKeyId: ctx.api_key_id,
          model: body.model,
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: null,
          status: 'error',
        }).catch(() => {});
      }

      if (err.openaiError) {
        return reply.code(err.statusCode || 502).send({ error: err.openaiError });
      }

      return reply.code(err.statusCode || 500).send({
        error: { message: err.message, type: err.type || 'api_error' },
      });
    }
  });
}

import { config } from '../config.js';

const ALLOWED_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'];

export function validateModel(model) {
  if (!ALLOWED_MODELS.includes(model)) {
    const err = new Error(`Model not supported in V0.1. Allowed: ${ALLOWED_MODELS.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }
}

function mockResponse(body) {
  const inputTokens = JSON.stringify(body.messages).length / 4 | 0;
  const outputTokens = 50;
  return {
    data: {
      id: 'chatcmpl-mock',
      object: 'chat.completion',
      model: body.model,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: '[MOCK] Zwima Gateway V0.1 – OpenAI mock response for local development.' },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens, total_tokens: inputTokens + outputTokens },
    },
    latencyMs: 120,
  };
}

export async function chatCompletion(body) {
  validateModel(body.model);

  if (config.mockOpenai || !config.openaiApiKey) {
    return mockResponse(body);
  }

  const start = Date.now();
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openaiApiKey}`,
    },
    body: JSON.stringify(body),
  });

  const latencyMs = Date.now() - start;
  const data = await response.json();

  if (!response.ok) {
    const err = new Error(data.error?.message || 'OpenAI request failed');
    err.statusCode = response.status;
    err.openaiError = data.error;
    throw err;
  }

  return { data, latencyMs };
}

export { ALLOWED_MODELS };

import crypto from 'crypto';

export function hashApiKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

export function generateApiKey(env = 'live') {
  const prefix = env === 'test' ? 'zwima_sk_test_' : 'zwima_sk_live_';
  const secret = crypto.randomBytes(24).toString('hex');
  const rawKey = prefix + secret;
  const displayPrefix = rawKey.slice(0, 20) + '••••' + rawKey.slice(-4);
  return { rawKey, keyPrefix: displayPrefix, keyHash: hashApiKey(rawKey) };
}

export function calculateCredits(inputTokens, outputTokens, model, modelFactors) {
  const factor = modelFactors[model] ?? 1.0;
  return Math.ceil((inputTokens + outputTokens) * factor);
}

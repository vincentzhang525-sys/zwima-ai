import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://zwima:zwima@localhost:5432/zwima_gateway',
  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-change-me',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  adminSecret: process.env.ADMIN_SECRET || 'dev-admin-secret',
  redisUrl: process.env.REDIS_URL || null,
  mockOpenai: process.env.MOCK_OPENAI === 'true',
  defaultMonthlyQuota: 10000,
  modelFactors: {
    'gpt-4o': 1.0,
    'gpt-4o-mini': 0.25,
    'gpt-3.5-turbo': 0.2,
  },
};

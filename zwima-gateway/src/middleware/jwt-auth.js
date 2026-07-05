import { verifyToken } from '../services/auth.service.js';

export async function jwtAuth(request, reply) {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Missing or invalid authorization header' });
  }

  const token = header.slice(7);

  try {
    const payload = verifyToken(token);
    request.user = { id: payload.sub, email: payload.email };
  } catch {
    return reply.code(401).send({ error: 'Invalid or expired token' });
  }
}

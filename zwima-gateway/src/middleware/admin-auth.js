import { config } from '../config.js';
import { verifyToken } from '../services/auth.service.js';
import { query } from '../db/index.js';

export async function adminAuth(request, reply) {
  const adminKey = request.headers['x-admin-secret'];
  if (adminKey && adminKey === config.adminSecret) {
    request.isAdmin = true;
    return;
  }

  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = verifyToken(header.slice(7));
      const result = await query('SELECT is_admin FROM users WHERE id = $1', [payload.sub]);
      if (result.rows[0]?.is_admin) {
        request.isAdmin = true;
        request.user = { id: payload.sub, email: payload.email };
        return;
      }
    } catch {
      /* fall through */
    }
  }

  return reply.code(401).send({ error: 'Admin authentication required' });
}

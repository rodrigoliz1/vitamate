import type { FastifyRequest } from 'fastify';
import { verifySupabaseAccessToken } from './supabase.js';

export async function requireUser(request: FastifyRequest): Promise<{ userId: string; token: string }> {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) throw Object.assign(new Error('Inicia sesión para continuar.'), { statusCode: 401, code: 'AUTH_REQUIRED' });
  const userId = await verifySupabaseAccessToken(token);
  if (!userId) throw Object.assign(new Error('Tu sesión venció. Vuelve a iniciar sesión.'), { statusCode: 401, code: 'INVALID_SESSION' });
  return { userId, token };
}

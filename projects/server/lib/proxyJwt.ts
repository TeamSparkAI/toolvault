import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { logger } from '@/lib/logging/server';

// Note: The JWT secret is generated dynmaically once per app instance.  When the app restarts, the secret will change, and any previously
//       issued tokens will be invalid.  Clients (in particular, our shim / tsh) will need to re-auth when this happens.

// Use global to ensure singleton persistence across module reloads
declare global {
  var jwtSecretInstance: string | null;
}

if (!global.jwtSecretInstance) {
  global.jwtSecretInstance = null;
}

function generateJwtSecret(): string {
  // Generate a cryptographically secure random 32-byte secret
  return randomBytes(32).toString('hex');
}

function getJwtSecret(): string {
  if (!global.jwtSecretInstance) {
    global.jwtSecretInstance = generateJwtSecret();
    logger.debug('Generated new JWT secret for this app instance');
  }
  return global.jwtSecretInstance;
}

export interface ProxyJwtPayload {
  user: string;
  sourceIp: string;
  serverToken: string;
  serverName: string;
  serverId: number;
  clientId: number | null;
}

export function createProxyToken(payload: ProxyJwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '1h' });
}

export function verifyProxyToken(token: string): ProxyJwtPayload {
  return jwt.verify(token, getJwtSecret()) as ProxyJwtPayload;
} 
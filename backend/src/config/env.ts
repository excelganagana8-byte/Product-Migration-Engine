import 'dotenv/config';
import { z } from 'zod';
const schema = z.object({ PORT: z.coerce.number().default(4000), NODE_ENV: z.string().default('development'), FRONTEND_ORIGIN: z.string().default('http://localhost:5173'), PME_ADMIN_TOKEN: z.string().optional(), CREDENTIAL_ENCRYPTION_KEY: z.string().optional(), ALLOW_PRIVATE_STORE_URLS: z.string().default('false') });
export const env = schema.parse(process.env);
export function encryptionKey(): Buffer {
  const key = env.CREDENTIAL_ENCRYPTION_KEY;
  if (!key || !/^[0-9a-fA-F]{64}$/.test(key)) throw new Error('CREDENTIAL_ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes).');
  return Buffer.from(key, 'hex');
}

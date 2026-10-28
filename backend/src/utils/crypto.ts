import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { encryptionKey } from '../config/env.js';
export function encryptJson(value: unknown): string {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [iv.toString('hex'), cipher.getAuthTag().toString('hex'), encrypted.toString('hex')].join(':');
}
export function decryptJson<T>(value: string): T {
  const [ivHex, tagHex, dataHex] = value.split(':');
  if (!ivHex || !tagHex || !dataHex) throw new Error('Stored credentials have an invalid format.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8')) as T;
}
export function redact(value: string): string { return value.replace(/(token|secret|password|consumer_key|consumer_secret)(["'\s:=]+)[^"'\s,}]+/gi, '$1$2[REDACTED]'); }

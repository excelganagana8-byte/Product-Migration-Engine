import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
function privateIPv4(ip: string) { const p=ip.split('.').map(Number); return p[0]===10 || p[0]===127 || p[0]===0 || (p[0]===169&&p[1]===254) || (p[0]===172&&p[1]>=16&&p[1]<=31) || (p[0]===192&&p[1]===168) || p[0]>=224; }
function privateIPv6(ip: string) { const s=ip.toLowerCase(); return s==='::1'||s==='::'||s.startsWith('fc')||s.startsWith('fd')||s.startsWith('fe80:')||s.startsWith('::ffff:127.')||s.startsWith('::ffff:10.'); }
export async function validateStoreUrl(input: string, allowPrivate=false): Promise<string> {
  let url: URL; try { url=new URL(input); } catch { throw new Error('Enter a valid store URL.'); }
  if (url.protocol !== 'https:' && !(allowPrivate && url.protocol==='http:')) throw new Error('Store URLs must use HTTPS (HTTP is allowed only for trusted local development).');
  if (url.username || url.password) throw new Error('Do not include credentials in the store URL.');
  if (url.search || url.hash) throw new Error('Store URL must not contain query parameters or fragments.');
  const host=url.hostname.toLowerCase();
  if (!allowPrivate) {
    if (host==='localhost' || host.endsWith('.localhost') || host.endsWith('.local')) throw new Error('Private/local store URLs are blocked.');
    if (isIP(host)===4 && privateIPv4(host)) throw new Error('Private/internal IP addresses are blocked.');
    if (isIP(host)===6 && privateIPv6(host)) throw new Error('Private/internal IP addresses are blocked.');
    if (!isIP(host)) { const resolved=await lookup(host,{all:true}); if(resolved.some(x=>isIP(x.address)===4?privateIPv4(x.address):privateIPv6(x.address))) throw new Error('Store hostname resolves to a private/internal address.'); }
  }
  return url.origin;
}

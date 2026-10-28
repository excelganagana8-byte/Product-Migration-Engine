import { validateStoreUrl } from '../../utils/store-url.js';
export type WooCredentials={consumerKey:string;consumerSecret:string};
export async function wooRequest<T>(storeUrl:string,credentials:WooCredentials,path:string,init:RequestInit={}):Promise<T>{
 const origin=await validateStoreUrl(storeUrl,process.env.ALLOW_PRIVATE_STORE_URLS==='true'); const url=new URL(`/wp-json/wc/v3/${path.replace(/^\//,'')}`,origin); const auth=Buffer.from(`${credentials.consumerKey}:${credentials.consumerSecret}`).toString('base64');
 const response=await fetch(url,{...init,headers:{authorization:`Basic ${auth}`,'content-type':'application/json',...(init.headers||{})},signal:init.signal||AbortSignal.timeout(30000)});
 if(response.status===429){const e=new Error('WooCommerce rate limit reached.');(e as Error & {status?:number}).status=429;throw e;}
 const text=await response.text();let body:any;try{body=text?JSON.parse(text):null}catch{body=text}
 if(!response.ok)throw new Error(`WooCommerce API error (${response.status}): ${typeof body==='object'?(body?.message||response.statusText):response.statusText}`);return body as T;
}
export async function testWooCommerce(storeUrl:string,credentials:WooCredentials){const data=await wooRequest<any>(storeUrl,credentials,'system_status');return {siteUrl:storeUrl,description:data?.environment?.site_url||storeUrl,woocommerceVersion:data?.environment?.version||'unknown'};}
export async function createWooProduct(storeUrl:string,credentials:WooCredentials,payload:Record<string,unknown>){return wooRequest<{id:number;name:string}>(storeUrl,credentials,'products',{method:'POST',body:JSON.stringify(payload)});}
export async function findWooProductBySourceId(storeUrl:string,credentials:WooCredentials,sourceId:string){for(let page=1;page<=100;page++){const rows=await wooRequest<any[]>(storeUrl,credentials,`products?per_page=100&page=${page}&orderby=id&order=desc`);const match=rows.find(p=>(p.meta_data||[]).some((m:any)=>m.key==='_pme_shopify_product_id'&&String(m.value)===sourceId));if(match)return match;if(rows.length<100)return null;}throw new Error('Destination catalog exceeds the 10,000-product idempotency lookup limit.');}

export async function createWooVariation(storeUrl:string,credentials:WooCredentials,parentId:string,payload:Record<string,unknown>){return wooRequest<{id:number;sku?:string}>(storeUrl,credentials,`products/${parentId}/variations`,{method:'POST',body:JSON.stringify(payload)});}
export async function listWooVariations(storeUrl:string,credentials:WooCredentials,parentId:string){return wooRequest<any[]>(storeUrl,credentials,`products/${parentId}/variations?per_page=100`);}

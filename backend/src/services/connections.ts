import { PrismaClient, Platform } from '@prisma/client';
import { encryptJson,decryptJson } from '../utils/crypto.js';
import { testShopify } from '../adapters/shopify/client.js';
import { testWooCommerce } from '../adapters/woocommerce/client.js';
import { validateStoreUrl } from '../utils/store-url.js';
const prisma=new PrismaClient();
export type ConnectionInput={name:string;platform:Platform;storeUrl:string;credentials:Record<string,string>};
export async function createConnection(input:ConnectionInput){const storeUrl=await validateStoreUrl(input.storeUrl,process.env.ALLOW_PRIVATE_STORE_URLS==='true');if(input.platform==='SHOPIFY'&&!input.credentials.accessToken)throw new Error('Shopify Admin API access token is required.');if(input.platform==='WOOCOMMERCE'&&(!input.credentials.consumerKey||!input.credentials.consumerSecret))throw new Error('WooCommerce consumer key and secret are required.');const record=await prisma.storeConnection.create({data:{name:input.name,platform:input.platform,storeUrl,encryptedCredentials:encryptJson(input.credentials)}});return {id:record.id,name:record.name,platform:record.platform,storeUrl:record.storeUrl,createdAt:record.createdAt};}
export async function listConnections(){return prisma.storeConnection.findMany({select:{id:true,name:true,platform:true,storeUrl:true,createdAt:true,updatedAt:true},orderBy:{createdAt:'desc'}});}
export async function getConnection(id:string){const c=await prisma.storeConnection.findUnique({where:{id}});if(!c)throw new Error('Connection not found.');return {...c,credentials:decryptJson<Record<string,string>>(c.encryptedCredentials)};}
export async function testConnection(id:string){const c=await getConnection(id);const result=c.platform==='SHOPIFY'?await testShopify(c.storeUrl,{accessToken:c.credentials.accessToken,apiVersion:c.credentials.apiVersion}):await testWooCommerce(c.storeUrl,{consumerKey:c.credentials.consumerKey,consumerSecret:c.credentials.consumerSecret});return {id:c.id,platform:c.platform,ok:true,details:result};}
export async function deleteConnection(id:string){return prisma.storeConnection.delete({where:{id},select:{id:true}});}

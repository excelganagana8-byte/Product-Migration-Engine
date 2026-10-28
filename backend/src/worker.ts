import { PrismaClient, JobStatus, ItemStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { getConnection } from './services/connections.js';
import { fetchShopifyProducts } from './adapters/shopify/client.js';
import { createWooProduct, createWooVariation, findWooProductBySourceId, listWooVariations, type WooCredentials } from './adapters/woocommerce/client.js';
import { toWooProduct } from './migrations/transform.js';
import type { NormalizedProduct, NormalizedVariant } from './types/product.js';
const prisma=new PrismaClient(); const workerId=randomUUID(); const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function claimJob(){return prisma.$transaction(async tx=>{await tx.$executeRaw`UPDATE "MigrationJob" SET status = 'QUEUED', "workerId" = NULL WHERE status = 'RUNNING' AND "leaseUntil" IS NOT NULL AND "leaseUntil" < NOW()`;const rows=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "MigrationJob" WHERE status = 'QUEUED' AND "cancelRequested" = false ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1`;if(!rows.length)return null;const id=rows[0].id;await tx.migrationJob.update({where:{id},data:{status:JobStatus.RUNNING,workerId,leaseUntil:new Date(Date.now()+300_000),startedAt:new Date(),currentActivity:'Starting migration'}});return tx.migrationJob.findUnique({where:{id}})});}
function variantPayload(variant:NormalizedVariant, product:NormalizedProduct){return {sku:variant.sku||undefined,regular_price:variant.price,manage_stock:variant.inventoryQuantity!==null,stock_quantity:variant.inventoryQuantity===null?undefined:Math.max(0,variant.inventoryQuantity),attributes:product.options.slice(0,3).map(option=>({name:option.name,option:variant.options[option.name]||option.values[0]||''})),meta_data:[{key:'_pme_shopify_variant_id',value:variant.sourceId}]};}
async function saveMapping(jobId:string,entityType:'PRODUCT'|'VARIATION',sourceId:string,destinationId:string){await prisma.recordMapping.upsert({where:{jobId_entityType_sourceId:{jobId,entityType,sourceId}},create:{jobId,entityType,sourceId,destinationId},update:{destinationId}});}
async function migrateProduct(jobId:string,product:NormalizedProduct,destinationUrl:string,credentials:WooCredentials):Promise<{destinationId:string;warnings:string[]}>{
 const mapped=await prisma.recordMapping.findFirst({where:{jobId,entityType:'PRODUCT',sourceId:product.sourceId}});let destinationId=mapped?.destinationId;
 if(!destinationId){const found=await findWooProductBySourceId(destinationUrl,credentials,product.sourceId);if(found)destinationId=String(found.id);}
 if(!destinationId){const created=await createWooProduct(destinationUrl,credentials,{...toWooProduct(product),meta_data:[{key:'_pme_shopify_product_id',value:product.sourceId},{key:'_pme_source_handle',value:product.handle}]});destinationId=String(created.id);}
 // Save immediately after parent creation; metadata lookup recovers if the process crashes before this write.
 await saveMapping(jobId,'PRODUCT',product.sourceId,destinationId);
 const warnings=[...product.warnings];
 const variable=product.options.length>0&&product.variants.length>1;
 if(variable){
   if(product.variants.length>100)throw new Error('This product has more than 100 variants. Variation pagination is not implemented yet; product was not marked successful.');
   const existing=await listWooVariations(destinationUrl,credentials,destinationId);
   for(const variant of product.variants){
     const mapping=await prisma.recordMapping.findFirst({where:{jobId,entityType:'VARIATION',sourceId:variant.sourceId}});
     const byMeta=existing.find(v=>(v.meta_data||[]).some((m:any)=>m.key==='_pme_shopify_variant_id'&&String(m.value)===variant.sourceId));
     const bySku=variant.sku?existing.find(v=>v.sku===variant.sku):undefined;
     const found=mapping?existing.find(v=>String(v.id)===mapping.destinationId):undefined;
     let variation=found||byMeta||bySku;
     if(!variation){variation=await createWooVariation(destinationUrl,credentials,destinationId,variantPayload(variant,product));existing.push(variation);}
     await saveMapping(jobId,'VARIATION',variant.sourceId,String(variation.id));
   }
 }
 if(product.options.length>3)warnings.push('Only the first three product options are represented in WooCommerce.');
 if(product.variants.some(v=>v.compareAtPrice&&Number(v.compareAtPrice)>Number(v.price)))warnings.push('Compare-at prices are not mapped to sale prices.');
 return {destinationId,warnings};
}
async function processJob(jobId:string){const job=await prisma.migrationJob.findUnique({where:{id:jobId}});if(!job)return;const source=await getConnection(job.sourceConnectionId);const destination=await getConnection(job.destinationConnectionId);let finalStatus:JobStatus=JobStatus.COMPLETED;
 try{const products=await fetchShopifyProducts(source.storeUrl,{accessToken:source.credentials.accessToken,apiVersion:source.credentials.apiVersion});const itemRows=await prisma.jobItem.findMany({where:{jobId,entityType:'PRODUCT'},select:{sourceId:true,status:true}});const eligible=new Set(itemRows.filter(i=>i.status!==ItemStatus.SUCCEEDED&&i.status!==ItemStatus.SKIPPED).map(i=>i.sourceId));const sourceProducts=products.filter(p=>eligible.has(p.sourceId));
 for(let index=0;index<sourceProducts.length;index++){const product=sourceProducts[index];const current=await prisma.migrationJob.findUnique({where:{id:jobId},select:{cancelRequested:true}});if(current?.cancelRequested){finalStatus=JobStatus.CANCELLED;break;}const item=await prisma.jobItem.findFirst({where:{jobId,sourceId:product.sourceId,entityType:'PRODUCT'}});if(!item)continue;await prisma.jobItem.update({where:{id:item.id},data:{status:ItemStatus.RUNNING,attempts:{increment:1},startedAt:new Date(),errorCode:null,errorMessage:null}});await prisma.migrationJob.update({where:{id:jobId},data:{currentActivity:`Migrating ${index+1} of ${sourceProducts.length}: ${product.title}`,leaseUntil:new Date(Date.now()+300_000)}});
 try{const result=await migrateProduct(jobId,product,destination.storeUrl,{consumerKey:destination.credentials.consumerKey,consumerSecret:destination.credentials.consumerSecret});await prisma.jobItem.update({where:{id:item.id},data:{status:ItemStatus.SUCCEEDED,destinationId:result.destinationId,finishedAt:new Date(),errorMessage:result.warnings.length?result.warnings.join(' '):null}});await prisma.jobLogEvent.create({data:{jobId,event:'product_migrated',message:`Migrated ${product.title} to WooCommerce product ${result.destinationId}${result.warnings.length?` with ${result.warnings.length} warning(s)`:''}.`}});
 }catch(err){const e=err as Error;await prisma.jobItem.update({where:{id:item.id},data:{status:ItemStatus.FAILED,errorCode:'MIGRATION_ITEM_FAILED',errorMessage:e.message.slice(0,1000),finishedAt:new Date()}});await prisma.jobLogEvent.create({data:{jobId,level:'error',event:'product_failed',message:`Failed ${product.title}: ${e.message.slice(0,800)}`}});finalStatus=JobStatus.COMPLETED_WITH_ERRORS;}
 const counts=await prisma.jobItem.groupBy({by:['status'],where:{jobId},_count:{_all:true}});const totals=Object.fromEntries(counts.map(c=>[c.status,c._count._all]));await prisma.migrationJob.update({where:{id:jobId},data:{succeeded:totals.SUCCEEDED||0,failed:totals.FAILED||0,skipped:totals.SKIPPED||0}});
 }
 }catch(err){finalStatus=JobStatus.FAILED;await prisma.jobLogEvent.create({data:{jobId,level:'error',event:'job_failed',message:`Migration stopped: ${(err as Error).message.slice(0,800)}`}})}
 const counts=await prisma.jobItem.groupBy({by:['status'],where:{jobId},_count:{_all:true}});const totals=Object.fromEntries(counts.map(c=>[c.status,c._count._all]));if((totals.FAILED||0)>0&&finalStatus===JobStatus.COMPLETED)finalStatus=JobStatus.COMPLETED_WITH_ERRORS;await prisma.migrationJob.update({where:{id:jobId},data:{status:finalStatus,succeeded:totals.SUCCEEDED||0,failed:totals.FAILED||0,skipped:totals.SKIPPED||0,finishedAt:new Date(),currentActivity:finalStatus==='COMPLETED'?'Migration completed':finalStatus==='COMPLETED_WITH_ERRORS'?'Completed with errors':finalStatus.toLowerCase()}});
}
console.log(`PME worker ${workerId} started`);while(true){try{const job=await claimJob();if(job)await processJob(job.id);else await sleep(1500)}catch(err){console.error('Worker loop error:',(err as Error).message);await sleep(3000)}}

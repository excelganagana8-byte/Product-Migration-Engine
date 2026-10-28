import type { NormalizedProduct } from '../types/product.js';
export type WooProductPayload=Record<string,unknown>;
export function toWooProduct(product:NormalizedProduct):WooProductPayload {
 const variants=product.variants.length?product.variants:[]; const hasOptions=product.options.length>0&&variants.length>1;
 const uniqueSkus=new Set<string>(); for(const v of variants){if(v.sku){if(uniqueSkus.has(v.sku))product.warnings.push(`Duplicate SKU in source variants: ${v.sku}`);uniqueSkus.add(v.sku);}}
 const attributes=product.options.slice(0,3).map((option,index)=>({name:option.name,visible:true,variation:hasOptions,options:[...new Set(option.values)]}));
 const payload:WooProductPayload={name:product.title,type:hasOptions?'variable':'simple',status:product.status,description:product.descriptionHtml,sku:!hasOptions&&variants.length===1?(variants[0].sku||''):undefined,regular_price:!hasOptions&&variants.length===1?variants[0].price:undefined,manage_stock:!hasOptions&&variants.length===1&&variants[0].inventoryQuantity!==null,stock_quantity:!hasOptions&&variants.length===1&&variants[0].inventoryQuantity!==null?Math.max(0,variants[0].inventoryQuantity):undefined,images:product.images.map(i=>({src:i.src,alt:i.alt||''})),attributes,meta_data:[{key:'_pme_shopify_product_id',value:product.sourceId},{key:'_pme_source_handle',value:product.handle}]};
 if(!product.images.length)product.warnings.push('No images will be imported.');
 if(product.options.length>3)product.warnings.push('Only the first three options can be represented in this WooCommerce payload.');

 if(variants.some(v=>v.compareAtPrice&&Number(v.compareAtPrice)>Number(v.price)))product.warnings.push('Compare-at prices are not mapped to a WooCommerce sale price in this initial implementation.');
 return payload;
}
export function summarizeProduct(p:NormalizedProduct){return {sourceId:p.sourceId,title:p.title,variantCount:p.variants.length,imageCount:p.images.length,warnings:p.warnings,action:'create'};}

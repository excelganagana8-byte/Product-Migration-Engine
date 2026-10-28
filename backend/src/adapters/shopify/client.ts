import type { NormalizedProduct } from "../../types/product.js";
import { validateStoreUrl } from "../../utils/store-url.js";
export type ShopifyCredentials = { accessToken: string; apiVersion?: string };
const PRODUCT_QUERY = `query Products($after: String) { products(first: 100, after: $after, sortKey: ID) { nodes { id title handle descriptionHtml status vendor tags options { name values } featuredImage { url altText } images(first: 100) { nodes { url altText } } variants(first: 100) { nodes { id title sku price compareAtPrice inventoryQuantity barcode selectedOptions { name value } } pageInfo { hasNextPage endCursor } } } pageInfo { hasNextPage endCursor } } }`;
export async function shopifyRequest<T>(
  storeUrl: string,
  credentials: ShopifyCredentials,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const origin = await validateStoreUrl(
    storeUrl,
    process.env.ALLOW_PRIVATE_STORE_URLS === "true",
  );
  const version = credentials.apiVersion || "2025-10";
  const response = await fetch(`${origin}/admin/api/${version}/graphql.json`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Shopify-Access-Token": credentials.accessToken,
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(30000),
  });
  if (response.status === 429) {
    const e = new Error(
      "Shopify rate limit reached. Retry the request shortly.",
    );
    (e as Error & { status?: number }).status = 429;
    throw e;
  }
  const body = (await response.json()) as {
    data?: T;
    errors?: { message: string }[];
  };
  if (!response.ok || body.errors?.length)
    throw new Error(
      `Shopify API error: ${(body.errors || []).map((e) => e.message).join("; ") || response.statusText}`,
    );
  if (!body.data) throw new Error("Shopify returned no data.");
  return body.data;
}
export async function testShopify(
  storeUrl: string,
  credentials: ShopifyCredentials,
) {
  const data = await shopifyRequest<{
    shop: { name: string; myshopifyDomain: string };
  }>(storeUrl, credentials, "query { shop { name myshopifyDomain } }");
  return { name: data.shop.name, domain: data.shop.myshopifyDomain };
}
export async function fetchShopifyProducts(
  storeUrl: string,
  credentials: ShopifyCredentials,
  onProduct?: (p: NormalizedProduct) => Promise<void>,
): Promise<NormalizedProduct[]> {
  let after: string | null = null;
  let hasNextPage = true;
  const products: NormalizedProduct[] = [];
  let pages = 0;

  while (hasNextPage) {
    const result: {
      products: {
        nodes: any[];
        pageInfo: {
          hasNextPage: boolean;
          endCursor: string | null;
        };
      };
    } = await shopifyRequest<{
      products: {
        nodes: any[];
        pageInfo: {
          hasNextPage: boolean;
          endCursor: string | null;
        };
      };
    }>(storeUrl, credentials, PRODUCT_QUERY, { after });

    for (const p of result.products.nodes) {
      const variants = (p.variants?.nodes || []).map((v: any) => ({
        sourceId: String(v.id),
        title: v.title === "Default Title" ? p.title : v.title,
        sku: v.sku || null,
        price: String(v.price ?? "0"),
        compareAtPrice:
          v.compareAtPrice == null ? null : String(v.compareAtPrice),
        inventoryQuantity: Number.isFinite(v.inventoryQuantity)
          ? v.inventoryQuantity
          : null,
        options: Object.fromEntries(
          (v.selectedOptions || []).map((o: any) => [o.name, o.value]),
        ),
        barcode: v.barcode || null,
      }));
      const imgs = (p.images?.nodes || []).map((i: any, index: number) => ({
        src: i.url,
        alt: i.altText || undefined,
        position: index + 1,
      }));
      const warnings: string[] = [];
      if (!imgs.length) warnings.push("No product images found.");
      if (variants.some((v: any) => !v.sku))
        warnings.push("One or more variants have no SKU.");
      if (p.status === "ARCHIVED")
        warnings.push("Archived Shopify product will be imported as draft.");
      if ((p.options || []).length > 3)
        warnings.push(
          "WooCommerce option mapping needs review: more than three Shopify options.",
        );
      const normalized: NormalizedProduct = {
        sourceId: String(p.id),
        title: p.title,
        descriptionHtml: p.descriptionHtml || "",
        handle: p.handle,
        status: p.status === "ACTIVE" ? "publish" : "draft",
        vendor: p.vendor || undefined,
        tags: p.tags || [],
        options: p.options || [],
        variants,
        images: imgs,
        warnings,
      };
      products.push(normalized);
      if (onProduct) await onProduct(normalized);
    }
    hasNextPage = result.products.pageInfo.hasNextPage;
    after = result.products.pageInfo.endCursor;
    pages++;
    if (pages > 10000) throw new Error("Pagination safety limit reached.");
    if (hasNextPage && !after)
      throw new Error("Shopify pagination returned no cursor.");
    // Shopify's GraphQL nested variants connection is capped per product; products with >100 variants need a future nested-connection pagination path.
  }
  return products;
}

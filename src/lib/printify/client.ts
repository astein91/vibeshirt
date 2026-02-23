const PRINTIFY_API_TOKEN = process.env.PRINTIFY_API_TOKEN;
const PRINTIFY_SHOP_ID = process.env.PRINTIFY_SHOP_ID;
const PRINTIFY_BASE_URL = "https://api.printify.com/v1";

interface PrintifyRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
}

// Make authenticated requests to Printify API
export async function printifyRequest<T>(
  endpoint: string,
  options: PrintifyRequestOptions = {}
): Promise<T> {
  if (!PRINTIFY_API_TOKEN) {
    throw new Error("Printify API token not configured");
  }

  const url = `${PRINTIFY_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${PRINTIFY_API_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "vibeshirt-app",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Printify API error (${response.status}): ${error}`);
  }

  return response.json();
}

// Get all shops for the account
export async function getShops(): Promise<Array<{ id: number; title: string }>> {
  return printifyRequest("/shops.json");
}

// Get the configured shop ID
export function getShopId(): string {
  if (!PRINTIFY_SHOP_ID) {
    throw new Error("Printify shop ID not configured");
  }
  return PRINTIFY_SHOP_ID;
}

// Blueprint types
export interface Blueprint {
  id: number;
  title: string;
  description: string;
  brand: string;
  model: string;
  images: string[];
}

// Get all blueprints (product templates)
export async function getBlueprints(): Promise<Blueprint[]> {
  return printifyRequest("/catalog/blueprints.json");
}

// Get a specific blueprint
export async function getBlueprint(blueprintId: number): Promise<Blueprint> {
  return printifyRequest(`/catalog/blueprints/${blueprintId}.json`);
}

// Print provider types
export interface PrintProvider {
  id: number;
  title: string;
  location: {
    address1: string;
    city: string;
    country: string;
    region: string;
    zip: string;
  };
}

// Get print providers for a blueprint
export async function getPrintProviders(
  blueprintId: number
): Promise<PrintProvider[]> {
  return printifyRequest(`/catalog/blueprints/${blueprintId}/print_providers.json`);
}

// Variant types
export interface Variant {
  id: number;
  title: string;
  options: {
    color: string;
    size: string;
  };
  placeholders: Array<{
    position: string;
    height: number;
    width: number;
  }>;
}

// Get variants for a blueprint/provider combination
export async function getVariants(
  blueprintId: number,
  printProviderId: number
): Promise<{ variants: Variant[] }> {
  return printifyRequest(
    `/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/variants.json`
  );
}

// Upload an image to Printify
export interface UploadedImage {
  id: string;
  file_name: string;
  height: number;
  width: number;
  size: number;
  mime_type: string;
  preview_url: string;
  upload_time: string;
}

export async function uploadImage(
  fileName: string,
  imageUrl: string
): Promise<UploadedImage> {
  return printifyRequest(`/uploads/images.json`, {
    method: "POST",
    body: {
      file_name: fileName,
      url: imageUrl,
    },
  });
}

// Create a product
export interface CreateProductInput {
  title: string;
  description: string;
  blueprint_id: number;
  print_provider_id: number;
  variants: Array<{
    id: number;
    price: number;
    is_enabled: boolean;
  }>;
  print_areas: Array<{
    variant_ids: number[];
    placeholders: Array<{
      position: string;
      images: Array<{
        id: string;
        x: number;
        y: number;
        scale: number;
        angle: number;
      }>;
    }>;
  }>;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  tags: string[];
  options: unknown[];
  variants: unknown[];
  images: Array<{
    src: string;
    variant_ids: number[];
    position: string;
    is_default: boolean;
  }>;
  created_at: string;
  updated_at: string;
  visible: boolean;
  is_locked: boolean;
  blueprint_id: number;
  user_id: number;
  shop_id: number;
  print_provider_id: number;
  print_areas: unknown[];
  sales_channel_properties: unknown[];
}

export async function createProduct(
  shopId: string,
  product: CreateProductInput
): Promise<Product> {
  return printifyRequest(`/shops/${shopId}/products.json`, {
    method: "POST",
    body: product,
  });
}

// Get a product
export async function getProduct(
  shopId: string,
  productId: string
): Promise<Product> {
  return printifyRequest(`/shops/${shopId}/products/${productId}.json`);
}

// Publish a product to the shop
export async function publishProduct(
  shopId: string,
  productId: string
): Promise<void> {
  await printifyRequest(`/shops/${shopId}/products/${productId}/publish.json`, {
    method: "POST",
    body: {
      title: true,
      description: true,
      images: true,
      variants: true,
      tags: true,
      keyFeatures: true,
      shipping_template: true,
    },
  });
}

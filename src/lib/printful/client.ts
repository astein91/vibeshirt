// Printful API Client
// Documentation: https://developers.printful.com/docs/

const PRINTFUL_API_BASE = "https://api.printful.com";

interface PrintfulResponse<T> {
  code: number;
  result: T;
  extra?: unknown[];
}

interface PrintfulError {
  code: number;
  result: string;
  error?: {
    reason: string;
    message: string;
  };
}

class PrintfulClient {
  private token: string;
  private storeId: string | null;

  constructor(token: string, storeId?: string) {
    this.token = token;
    this.storeId = storeId || null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requiresStore = false
  ): Promise<T> {
    const url = `${PRINTFUL_API_BASE}${endpoint}`;

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${this.token}`,
      "Content-Type": "application/json",
    };

    // Add store ID header for endpoints that require it
    if (requiresStore && this.storeId) {
      headers["X-PF-Store-Id"] = this.storeId;
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok || data.code !== 200) {
      const error = data as PrintfulError;
      throw new Error(
        error.error?.message || error.result || `Printful API error: ${response.status}`
      );
    }

    return (data as PrintfulResponse<T>).result;
  }

  // Get all available products in catalog
  async getProducts(categoryId?: number): Promise<CatalogProduct[]> {
    const params = categoryId ? `?category_id=${categoryId}` : "";
    return this.request<CatalogProduct[]>(`/products${params}`);
  }

  // Get single product with all variants
  async getProduct(productId: number): Promise<ProductDetails> {
    return this.request<ProductDetails>(`/products/${productId}`);
  }

  // Get product variant details
  async getVariant(variantId: number): Promise<Variant> {
    return this.request<Variant>(`/products/variant/${variantId}`);
  }

  // Get categories
  async getCategories(): Promise<Category[]> {
    return this.request<Category[]>("/categories");
  }

  // Create mockup generation task (requires store)
  async createMockupTask(
    productId: number,
    params: MockupTaskParams
  ): Promise<MockupTaskResponse> {
    return this.request<MockupTaskResponse>(
      `/mockup-generator/create-task/${productId}`,
      {
        method: "POST",
        body: JSON.stringify(params),
      },
      true // requires store ID
    );
  }

  // Get mockup generation task result (requires store)
  async getMockupTaskResult(taskKey: string): Promise<MockupResult> {
    return this.request<MockupResult>(
      `/mockup-generator/task?task_key=${taskKey}`,
      {},
      true // requires store ID
    );
  }

  // Get printfiles info for a variant (requires store)
  async getPrintfiles(productId: number): Promise<PrintfileInfo> {
    return this.request<PrintfileInfo>(
      `/mockup-generator/printfiles/${productId}`,
      {},
      true // requires store ID
    );
  }

  // Create a sync product in the store (requires store)
  async createSyncProduct(body: SyncProductInput): Promise<SyncProduct> {
    return this.request<SyncProduct>(
      `/store/products`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      true // requires store ID
    );
  }

  // Get a sync product from the store (requires store)
  async getSyncProduct(id: number): Promise<SyncProduct> {
    return this.request<SyncProduct>(
      `/store/products/${id}`,
      {},
      true // requires store ID
    );
  }
}

// Type definitions

export interface CatalogProduct {
  id: number;
  type: string;
  type_name: string;
  brand: string | null;
  model: string;
  image: string;
  variant_count: number;
  currency: string;
  options: ProductOption[];
  dimensions: {
    front?: string;
  } | null;
  is_discontinued: boolean;
  description: string;
  techniques: Technique[];
  files: FileSpec[];
}

export interface ProductDetails {
  product: CatalogProduct;
  variants: Variant[];
}

export interface Variant {
  id: number;
  product_id: number;
  name: string;
  size: string;
  color: string;
  color_code: string; // Hex color code
  color_code2: string | null; // Secondary color for heathers
  image: string;
  price: string;
  in_stock: boolean;
  availability_regions: Record<string, string>;
  availability_status: AvailabilityStatus[];
}

export interface AvailabilityStatus {
  region: string;
  status: string;
}

export interface ProductOption {
  id: string;
  title: string;
  type: string;
  values: Record<string, string>;
  additional_price?: string;
  additional_price_breakdown?: Record<string, string>;
}

export interface Technique {
  key: string;
  display_name: string;
  is_default: boolean;
}

export interface FileSpec {
  id: string;
  type: string;
  title: string;
  additional_price: string | null;
  options: FileOption[];
}

export interface FileOption {
  id: string;
  title: string;
  additional_price: string | null;
}

export interface Category {
  id: number;
  parent_id: number;
  image_url: string;
  catalog_position: number;
  size: string;
  title: string;
}

export interface MockupTaskParams {
  variant_ids: number[];
  format?: "jpg" | "png";
  width?: number;
  product_options?: Record<string, string>;
  option_groups?: string[];
  options?: string[];
  files: MockupFile[];
}

export interface MockupFile {
  placement: string; // "front", "back", etc.
  image_url: string;
  position?: {
    area_width: number;
    area_height: number;
    width: number;
    height: number;
    top: number;
    left: number;
  };
}

export interface MockupTaskResponse {
  task_key: string;
  status: "pending" | "completed" | "error";
}

export interface MockupResult {
  task_key: string;
  status: "pending" | "completed" | "error";
  mockups?: GeneratedMockup[];
  error?: string;
  printfiles?: PrintfileInfo[];
}

export interface GeneratedMockup {
  placement: string;
  variant_ids: number[];
  mockup_url: string;
  extra?: ExtraMockup[];
}

export interface ExtraMockup {
  title: string;
  url: string;
  option: string;
  option_group: string;
}

export interface PrintfileInfo {
  product_id: number;
  available_placements: Record<string, string>; // placement -> title (e.g., "front" -> "Front print")
  printfiles: Printfile[];
  variant_printfiles: VariantPrintfile[];
  option_groups: string[];
  options: string[];
}

export interface Printfile {
  printfile_id: number;
  width: number;
  height: number;
  dpi: number;
  fill_mode: string;
  can_rotate: boolean;
}

export interface VariantPrintfile {
  variant_id: number;
  placements: Record<string, VariantPlacement>;
}

export interface VariantPlacement {
  printfile_id: number;
  technique?: string;
}

// Sync Products types

export interface SyncProductFile {
  url: string;
  type: "front" | "back" | "label_outside" | "label_inside";
}

export interface SyncVariantInput {
  variant_id: number;
  retail_price: string; // e.g. "24.99"
  files: SyncProductFile[];
}

export interface SyncProductInput {
  sync_product: {
    name: string;
    thumbnail?: string;
  };
  sync_variants: SyncVariantInput[];
}

export interface SyncProduct {
  id: number;
  external_id: string;
  name: string;
  variants: number;
  synced: number;
  thumbnail_url: string | null;
}

// Singleton client instance
let client: PrintfulClient | null = null;

export function getPrintfulClient(): PrintfulClient {
  if (!client) {
    const token = process.env.PRINTFUL_API_TOKEN;
    if (!token) {
      throw new Error("PRINTFUL_API_TOKEN environment variable is not set");
    }
    const storeId = process.env.PRINTFUL_STORE_ID;
    client = new PrintfulClient(token, storeId);
  }
  return client;
}

export { PrintfulClient };

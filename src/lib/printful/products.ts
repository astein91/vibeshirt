export type FitType = "mens" | "womens";

export const PRODUCTS: Record<FitType, { id: number; label: string }> = {
  mens: { id: 586, label: "Men's" }, // Comfort Colors 1717
  womens: { id: 862, label: "Women's" }, // Comfort Colors 3023CL
};

export const DEFAULT_FIT: FitType = "mens";
export const DEFAULT_PRODUCT_ID = PRODUCTS[DEFAULT_FIT].id;

export function getProductId(fit: FitType): number {
  return PRODUCTS[fit].id;
}

export function getFit(productId: number): FitType {
  for (const [fit, product] of Object.entries(PRODUCTS)) {
    if (product.id === productId) return fit as FitType;
  }
  return DEFAULT_FIT;
}

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getPrintfulClient, type OrderRecipient } from "@/lib/printful/client";

// POST /api/checkout - Create a Printful draft order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, variantId, quantity = 1, recipient } = body as {
      sessionId: string;
      variantId: number;
      quantity?: number;
      recipient: OrderRecipient;
    };

    if (!sessionId || !variantId || !recipient) {
      return NextResponse.json(
        { error: "sessionId, variantId, and recipient are required" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // 1. Fetch session — verify it has a Printful product
    const { data: session, error: sessionError } = await supabase
      .from("design_sessions")
      .select("id, status, printful_product_id, printful_config")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    if (!session.printful_product_id) {
      return NextResponse.json(
        { error: "No product created for this session yet" },
        { status: 400 }
      );
    }

    const printful = getPrintfulClient();

    // 2. Get sync product to find sync_variant_id matching the catalog variantId
    const syncProduct = await printful.getSyncProduct(
      parseInt(session.printful_product_id, 10)
    );

    const syncVariant = syncProduct.sync_variants.find(
      (sv) => sv.variant_id === variantId || sv.product.variant_id === variantId
    );

    if (!syncVariant) {
      return NextResponse.json(
        { error: "Variant not found in this product" },
        { status: 400 }
      );
    }

    // 3. Create draft order (confirm: false = no charge)
    const config = session.printful_config as { retailPrice?: string } | null;
    const retailPrice = config?.retailPrice || syncVariant.retail_price;

    const order = await printful.createOrder({
      recipient,
      items: [
        {
          sync_variant_id: syncVariant.id,
          quantity,
          retail_price: retailPrice,
        },
      ],
      confirm: false,
      external_id: sessionId,
    });

    // 4. Update session with order info
    await supabase
      .from("design_sessions")
      .update({
        status: "ORDERED",
        printful_order_id: String(order.id),
        order_recipient: recipient,
        ordered_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    return NextResponse.json({
      orderId: order.id,
      status: order.status,
      retailCosts: order.retail_costs,
    });
  } catch (error) {
    console.error("Checkout failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed" },
      { status: 500 }
    );
  }
}

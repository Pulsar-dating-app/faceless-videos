import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { supabase } from "@/lib/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    if (!webhookSecret) {
      return NextResponse.json(
        { error: "STRIPE_WEBHOOK_SECRET is not configured" },
        { status: 500 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Webhook signature verification failed:", errorMessage);
      return NextResponse.json(
        { error: `Webhook Error: ${errorMessage}` },
        { status: 400 }
      );
    }

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        
        if (session.mode === "subscription") {
          const subscriptionId = session.subscription as string;
          const userId = session.metadata?.supabase_user_id;
          const planId = session.metadata?.plan_id;

          if (userId) {
            // Update user subscription in Supabase
            // You may need to create a subscriptions table or update user metadata
            const { error } = await supabase
              .from("user_subscriptions")
              .upsert({
                user_id: userId,
                stripe_subscription_id: subscriptionId,
                stripe_customer_id: session.customer as string,
                plan_id: planId,
                status: "active",
                updated_at: new Date().toISOString(),
              }, {
                onConflict: "user_id",
              });

            if (error) {
              console.error("Error updating subscription in Supabase:", error);
            }
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        
        // Find user by customer ID
        const { data: subscriptionData } = await supabase
          .from("user_subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", subscription.customer as string)
          .single();

        if (subscriptionData) {
          const { error } = await supabase
            .from("user_subscriptions")
            .update({
              status: subscription.status,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", subscriptionData.user_id);

          if (error) {
            console.error("Error updating subscription status:", error);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        
        // Find user by customer ID
        const { data: subscriptionData } = await supabase
          .from("user_subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", subscription.customer as string)
          .single();

        if (subscriptionData) {
          const { error } = await supabase
            .from("user_subscriptions")
            .update({
              status: "canceled",
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", subscriptionData.user_id);

          if (error) {
            console.error("Error canceling subscription:", error);
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Webhook handler failed";
    console.error("Webhook error:", errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}


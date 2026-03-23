import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabase } from '@/lib/supabase'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' })

const PLAN_MAP: Record<string, string> = {
  [process.env.STRIPE_STARTER_PRICE_ID!]: 'starter',
  [process.env.STRIPE_PRO_PRICE_ID!]:     'pro',
  [process.env.STRIPE_TEAM_PRICE_ID!]:    'team',
}

function mapSubscriptionStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case 'active':   return 'active'
    case 'trialing': return 'trialing'
    case 'past_due': return 'past_due'
    default:         return 'canceled'
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const priceId = subscription.items.data[0]?.price.id
        const plan    = PLAN_MAP[priceId] || 'starter'
        const status  = mapSubscriptionStatus(subscription.status)

        await supabase
          .from('organizations')
          .update({
            plan,
            plan_status: status,
            stripe_subscription_id: subscription.id,
          })
          .eq('stripe_customer_id', subscription.customer as string)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await supabase
          .from('organizations')
          .update({
            plan: 'starter',
            plan_status: 'canceled',
            stripe_subscription_id: null,
          })
          .eq('stripe_customer_id', subscription.customer as string)
        break
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.metadata?.org_id && session.customer) {
          await supabase
            .from('organizations')
            .update({ stripe_customer_id: session.customer as string })
            .eq('id', session.metadata.org_id)
        }
        break
      }

      default:
        // Unhandled event type — return 200 so Stripe doesn't retry
        break
    }
  } catch (err) {
    console.error(`Stripe webhook handler failed for ${event.type}:`, err)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

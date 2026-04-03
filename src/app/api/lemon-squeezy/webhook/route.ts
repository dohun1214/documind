import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'

// Lemon Squeezy sends webhook events as POST requests with a JSON body
// and X-Signature header for verification.

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret)
  const digest = hmac.update(payload).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('X-Signature')
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET

  if (!secret) {
    console.error('LEMONSQUEEZY_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const rawBody = await request.text()

  if (!signature || !verifyWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(rawBody)
  const eventName: string = event.meta?.event_name

  const supabase = createServiceClient()

  try {
    switch (eventName) {
      case 'subscription_created':
      case 'subscription_updated':
      case 'subscription_payment_success': {
        const attrs = event.data?.attributes
        const userId = event.meta?.custom_data?.user_id

        if (!userId) {
          console.error('No user_id in webhook custom_data')
          break
        }

        await supabase.from('subscriptions').upsert(
          {
            user_id: userId,
            plan: 'pro',
            status: mapStatus(attrs?.status),
            lemon_squeezy_subscription_id: String(event.data?.id),
            lemon_squeezy_customer_id: String(attrs?.customer_id),
            lemon_squeezy_order_id: String(attrs?.order_id),
            current_period_start: attrs?.renews_at ?? null,
            current_period_end: attrs?.ends_at ?? attrs?.renews_at ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        break
      }

      case 'subscription_cancelled':
      case 'subscription_expired': {
        const subscriptionId = String(event.data?.id)
        await supabase
          .from('subscriptions')
          .update({
            status: 'cancelled',
            plan: 'free',
            updated_at: new Date().toISOString(),
          })
          .eq('lemon_squeezy_subscription_id', subscriptionId)
        break
      }

      default:
        // Unhandled event — log and acknowledge
        console.log(`Unhandled Lemon Squeezy event: ${eventName}`)
    }
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

function mapStatus(lsStatus: string): 'active' | 'cancelled' | 'past_due' | 'paused' {
  switch (lsStatus) {
    case 'active':
      return 'active'
    case 'cancelled':
      return 'cancelled'
    case 'past_due':
      return 'past_due'
    case 'paused':
      return 'paused'
    default:
      return 'active'
  }
}

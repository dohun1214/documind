import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCheckoutUrl } from '@/lib/lemon-squeezy/client'
import { PLANS } from '@/lib/lemon-squeezy/config'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const variantId = PLANS.pro.variantId
  if (!variantId) {
    return NextResponse.json(
      { error: 'Pro plan variant ID not configured' },
      { status: 500 }
    )
  }

  try {
    const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
      ?? new URL(request.url).origin
    const checkoutUrl = await createCheckoutUrl(variantId, {
      email: user.email,
      userId: user.id,
      redirectUrl: `${origin}/dashboard`,
    })

    return NextResponse.json({ url: checkoutUrl })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json({ error: 'Failed to create checkout' }, { status: 500 })
  }
}

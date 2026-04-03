import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { initLemonSqueezy } from '@/lib/lemon-squeezy/client'
import { getSubscription } from '@lemonsqueezy/lemonsqueezy.js'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('lemon_squeezy_subscription_id, plan, status')
    .eq('user_id', user.id)
    .single()

  if (!sub?.lemon_squeezy_subscription_id || sub.plan !== 'pro' || sub.status !== 'active') {
    return NextResponse.json({ error: 'No active Pro subscription' }, { status: 404 })
  }

  try {
    initLemonSqueezy()
    const { data, error } = await getSubscription(sub.lemon_squeezy_subscription_id)
    if (error || !data) throw new Error(error?.message ?? 'Failed to fetch subscription')

    const portalUrl = data.data.attributes.urls?.customer_portal
    if (!portalUrl) throw new Error('Portal URL not available')

    return NextResponse.json({ url: portalUrl })
  } catch (err) {
    console.error('Portal URL error:', err)
    return NextResponse.json({ error: 'Failed to get portal URL' }, { status: 500 })
  }
}

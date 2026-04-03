import { createClient } from '@/lib/supabase/server'
import { PLANS } from '@/lib/lemon-squeezy/config'
import type { SubscriptionPlan } from '@/types'

export async function checkDailyUsage(
  userId: string,
  action = 'default'
): Promise<{ count: number; limit: number | null; exceeded: boolean }> {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  // Get current plan
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', userId)
    .single()

  const plan = (subscription?.plan ?? 'free') as SubscriptionPlan
  const limit = PLANS[plan].dailyLimit

  // Get today's usage
  const { data: usage } = await supabase
    .from('usage_logs')
    .select('count')
    .eq('user_id', userId)
    .eq('action', action)
    .eq('date', today)
    .single()

  const count = usage?.count ?? 0
  const exceeded = limit !== null && count >= limit

  return { count, limit, exceeded }
}

export async function incrementUsage(
  userId: string,
  action = 'default'
): Promise<number> {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('usage_logs')
    .upsert(
      { user_id: userId, action, date: today, count: 1, updated_at: new Date().toISOString() },
      {
        onConflict: 'user_id,action,date',
        ignoreDuplicates: false,
      }
    )
    .select('count')
    .single()

  if (error) {
    // Fallback: manual increment
    const { data: existing } = await supabase
      .from('usage_logs')
      .select('count')
      .eq('user_id', userId)
      .eq('action', action)
      .eq('date', today)
      .single()

    const newCount = (existing?.count ?? 0) + 1
    await supabase
      .from('usage_logs')
      .update({ count: newCount, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('action', action)
      .eq('date', today)

    return newCount
  }

  return data?.count ?? 1
}

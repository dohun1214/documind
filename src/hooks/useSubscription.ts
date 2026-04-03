'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Subscription, SubscriptionPlan } from '@/types'

export function useSubscription(userId: string | undefined) {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    const supabase = createClient()

    supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => {
        setSubscription(data)
        setLoading(false)
      })
  }, [userId])

  const plan: SubscriptionPlan = subscription?.plan ?? 'free'
  const isPro = plan === 'pro' && subscription?.status === 'active'

  return { subscription, plan, isPro, loading }
}

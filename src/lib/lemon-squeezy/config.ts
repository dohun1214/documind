import type { Plans } from '@/types'

export const PLANS: Plans = {
  free: {
    name: 'Free',
    price: 0,
    priceLabel: 'Free forever',
    description: 'Perfect for getting started',
    variantId: null,
    dailyLimit: 10,
    features: [
      '10 actions per day',
      'Basic features',
      'Email support',
      'Community access',
    ],
  },
  pro: {
    name: 'Pro',
    price: 9.99,
    priceLabel: '$9.99 / month',
    description: 'For power users and teams',
    variantId: process.env.LEMONSQUEEZY_PRO_VARIANT_ID ?? null,
    dailyLimit: null,
    highlighted: true,
    features: [
      'Unlimited actions',
      'All Pro features',
      'Priority support',
      'Advanced analytics',
      'API access',
      'Custom integrations',
    ],
  },
}

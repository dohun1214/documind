import { lemonSqueezySetup, createCheckout } from '@lemonsqueezy/lemonsqueezy.js'

export function initLemonSqueezy() {
  lemonSqueezySetup({
    apiKey: process.env.LEMONSQUEEZY_API_KEY!,
    onError: (error) => console.error('Lemon Squeezy error:', error),
  })
}

export async function createCheckoutUrl(
  variantId: string,
  options: {
    email?: string
    userId?: string
    redirectUrl?: string
  } = {}
): Promise<string> {
  initLemonSqueezy()

  const storeId = process.env.LEMONSQUEEZY_STORE_ID!
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')

  const { data, error } = await createCheckout(storeId, variantId, {
    checkoutOptions: {
      embed: false,
      media: true,
      logo: true,
      successUrl: options.redirectUrl ?? (appUrl ? `${appUrl}/dashboard` : undefined),
    },
    checkoutData: {
      email: options.email,
      custom: {
        user_id: options.userId,
      },
    },
    productOptions: {
      enabledVariants: [parseInt(variantId)],
      receiptButtonText: 'Go to Dashboard',
      receiptThankYouNote: 'Thank you for upgrading to Pro!',
    },
  })

  if (error) {
    throw new Error(`Failed to create checkout: ${error.message}`)
  }

  return data!.data.attributes.url
}

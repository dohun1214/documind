export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  updated_at: string
}

export type SubscriptionPlan = 'free' | 'pro'
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'paused'

export interface Subscription {
  id: string
  user_id: string
  plan: SubscriptionPlan
  status: SubscriptionStatus
  lemon_squeezy_subscription_id: string | null
  lemon_squeezy_customer_id: string | null
  lemon_squeezy_order_id: string | null
  current_period_start: string | null
  current_period_end: string | null
  created_at: string
  updated_at: string
}

export interface UsageLog {
  id: string
  user_id: string
  action: string
  date: string
  count: number
  created_at: string
  updated_at: string
}

export interface PlanConfig {
  name: string
  price: number
  priceLabel: string
  description: string
  variantId: string | null
  dailyLimit: number | null  // null = unlimited
  features: string[]
  highlighted?: boolean
}

export type Plans = {
  free: PlanConfig
  pro: PlanConfig
}

export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'error'
export type FileType = 'pdf' | 'docx' | 'image'

export interface Document {
  id: string
  user_id: string
  title: string
  file_url: string
  file_type: FileType
  file_size: number | null
  page_count: number | null
  char_count: number | null
  summary: string | null
  key_points: string[] | null
  recommended_questions: string[] | null
  status: DocumentStatus
  created_at: string
  updated_at: string
}

export interface Chunk {
  id: string
  document_id: string
  chunk_index: number
  content: string
  page_number: number | null
  created_at: string
}

export interface Conversation {
  id: string
  document_id: string
  user_id: string
  question: string
  answer: string
  created_at: string
}

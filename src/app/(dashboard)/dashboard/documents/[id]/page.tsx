import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Metadata } from 'next'
import { DocumentAnalysis } from '@/components/dashboard/DocumentAnalysis'
import type { Document } from '@/types'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('documents').select('title').eq('id', id).single()
  return { title: data?.title ?? '문서 분석' }
}

export default async function DocumentPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: doc } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!doc) notFound()

  const [{ data: conversations }, { data: sub }] = await Promise.all([
    supabase
      .from('conversations')
      .select('id, question, answer, created_at')
      .eq('document_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', user.id)
      .single(),
  ])

  const isPro = sub?.plan === 'pro' && sub?.status === 'active'

  return (
    <DocumentAnalysis
      document={doc as Document}
      initialConversations={conversations ?? []}
      isPro={isPro}
    />
  )
}

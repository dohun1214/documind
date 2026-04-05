import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  generatePresentation,
  PresentationStyle,
  PresentationLanguage,
} from '@/lib/documents/ai'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data } = await supabase
    .from('presentations')
    .select('id, title, settings, created_at')
    .eq('document_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return Response.json(data ?? [])
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Pro-only
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .single()
  if (sub?.plan !== 'pro' || sub?.status !== 'active') {
    return new Response('프레젠테이션 기능은 Pro 전용입니다.', { status: 403 })
  }

  // Verify ownership
  const { data: doc } = await supabase
    .from('documents')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!doc) return new Response('Not found', { status: 404 })

  const body = await request.json() as {
    slides?: number
    style?: PresentationStyle
    language?: PresentationLanguage
  }
  const slideCount = Math.min(Math.max(body.slides ?? 10, 5), 15)
  const style: PresentationStyle = body.style ?? 'business'
  const language: PresentationLanguage = body.language ?? 'ko'

  // Get all chunks
  const { data: chunks } = await supabase
    .from('chunks')
    .select('content, chunk_index')
    .eq('document_id', id)
    .order('chunk_index')

  const fullText = (chunks ?? []).map(c => c.content).join('\n\n')
  if (!fullText) return new Response('문서 내용을 찾을 수 없습니다.', { status: 422 })

  const presentationData = await generatePresentation(fullText, slideCount, style, language)
  if (!presentationData) return new Response('프레젠테이션 생성에 실패했습니다.', { status: 500 })

  const { data: saved, error } = await supabase
    .from('presentations')
    .insert({
      document_id: id,
      user_id: user.id,
      settings: { slides: slideCount, style, language },
      title: presentationData.title,
      data: presentationData,
    })
    .select()
    .single()

  if (error) return new Response('저장에 실패했습니다.', { status: 500 })
  return Response.json(saved)
}

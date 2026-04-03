import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { streamTranslation } from '@/lib/documents/ai'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Pro only
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .single()
  const isPro = sub?.plan === 'pro' && sub?.status === 'active'
  if (!isPro) {
    return new Response('번역 기능은 Pro 플랜 전용입니다.', { status: 403 })
  }

  const { direction } = await request.json() as { direction: 'ko-en' | 'en-ko' }
  if (direction !== 'ko-en' && direction !== 'en-ko') {
    return new Response('direction must be ko-en or en-ko', { status: 400 })
  }

  // Verify ownership
  const { data: doc } = await supabase
    .from('documents')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!doc) return new Response('Not found', { status: 404 })

  // Get full text from chunks
  const { data: chunks } = await supabase
    .from('chunks')
    .select('content, chunk_index')
    .eq('document_id', id)
    .order('chunk_index')

  const fullText = (chunks ?? []).map(c => c.content).join('\n\n')
  if (!fullText.trim()) {
    return new Response('문서 내용을 불러올 수 없습니다.', { status: 422 })
  }

  const aiStream = streamTranslation(fullText, direction)

  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        for await (const event of aiStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
      } catch (e) {
        console.error('Translation streaming error:', e)
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  streamSummaryWithStyle,
  generateRecommendedQuestions,
  type SummaryStyle,
} from '@/lib/documents/ai'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = await request.json().catch(() => ({})) as { style?: SummaryStyle }
  const style: SummaryStyle = body.style ?? 'detailed'

  // Get document
  const { data: doc } = await supabase
    .from('documents')
    .select('id, user_id, summary, recommended_questions')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!doc) return new Response('Not found', { status: 404 })

  // For 'detailed' style: serve cached summary if it exists
  if (style === 'detailed' && doc.summary) {
    const text = doc.summary
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const chunkSize = 5
        for (let i = 0; i < text.length; i += chunkSize) {
          controller.enqueue(encoder.encode(text.slice(i, i + chunkSize)))
          await new Promise(r => setTimeout(r, 12))
        }
        controller.close()
      },
    })
    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  // Get full text from chunks
  const { data: chunks } = await supabase
    .from('chunks')
    .select('content, chunk_index')
    .eq('document_id', id)
    .order('chunk_index')

  const fullText = (chunks ?? []).map(c => c.content).join('\n\n')
  if (!fullText.trim()) {
    return new Response('문서 내용을 불러올 수 없습니다. 파일을 다시 업로드해주세요.', { status: 422 })
  }

  const claudeStream = streamSummaryWithStyle(fullText, style)
  let fullSummary = ''

  const readableStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        for await (const event of claudeStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const text = event.delta.text
            fullSummary += text
            controller.enqueue(encoder.encode(text))
          }
        }
        // Only save 'detailed' style to DB (source of truth)
        if (style === 'detailed') {
          await supabase
            .from('documents')
            .update({ summary: fullSummary, updated_at: new Date().toISOString() })
            .eq('id', id)
        }
        // Generate recommended questions as a side effect if not yet set
        if (!doc.recommended_questions) {
          generateRecommendedQuestions(fullText)
            .then(questions => {
              if (questions.length > 0) {
                supabase
                  .from('documents')
                  .update({ recommended_questions: questions })
                  .eq('id', id)
              }
            })
            .catch(() => {})
        }
      } catch (e) {
        console.error('Summarize streaming error:', e)
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readableStream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

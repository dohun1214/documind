import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { streamSummary } from '@/lib/documents/ai'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Get document + chunks
  const { data: doc } = await supabase
    .from('documents')
    .select('id, user_id, summary')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!doc) return new Response('Not found', { status: 404 })

  // If summary already exists, stream it character-by-character (same feel as Q&A)
  if (doc.summary) {
    const encoder = new TextEncoder()
    const text = doc.summary
    const stream = new ReadableStream({
      async start(controller) {
        const chunkSize = 5
        for (let i = 0; i < text.length; i += chunkSize) {
          controller.enqueue(encoder.encode(text.slice(i, i + chunkSize)))
          await new Promise(r => setTimeout(r, 15))
        }
        controller.close()
      },
    })
    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  // Get all chunks and reconstruct full text
  const { data: chunks } = await supabase
    .from('chunks')
    .select('content, chunk_index')
    .eq('document_id', id)
    .order('chunk_index')

  const fullText = (chunks ?? []).map(c => c.content).join('\n\n')

  if (!fullText.trim()) {
    return new Response('문서 내용을 불러올 수 없습니다. 파일을 다시 업로드해주세요.', { status: 422 })
  }

  // Stream from Claude
  const claudeStream = streamSummary(fullText)
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
        // Save summary to DB after streaming
        await supabase
          .from('documents')
          .update({ summary: fullSummary, updated_at: new Date().toISOString() })
          .eq('id', id)
      } catch (e) {
        console.error('Streaming error:', e)
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readableStream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

import { NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  streamSummaryWithStyle,
  streamSummaryWithPdfVision,
  generateRecommendedQuestions,
  type SummaryStyle,
} from '@/lib/documents/ai'

const PDF_VISION_PAGE_LIMIT = 30

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = await request.json().catch(() => ({})) as {
    style?: SummaryStyle
    includeImages?: boolean
  }
  const style: SummaryStyle = body.style ?? 'detailed'
  const includeImages = body.includeImages === true

  // Get document (include file info for PDF Vision path)
  const { data: doc } = await supabase
    .from('documents')
    .select('id, user_id, summary, recommended_questions, file_type, file_url, page_count')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!doc) return new Response('Not found', { status: 404 })

  // ── PDF Vision path ─────────────────────────────────────────────────────────
  if (includeImages && doc.file_type === 'pdf') {
    // Pro-only check
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', user.id)
      .single()
    const isPro = sub?.plan === 'pro' && sub?.status === 'active'
    if (!isPro) return new Response('Pro 전용 기능입니다.', { status: 403 })

    // Page limit
    const pageCount = doc.page_count ?? 0
    if (pageCount > PDF_VISION_PAGE_LIMIT) {
      return new Response(
        `이미지 포함 분석은 최대 ${PDF_VISION_PAGE_LIMIT}페이지까지 지원합니다. (현재: ${pageCount}페이지)`,
        { status: 400 }
      )
    }

    // Extract storage key and download PDF
    let storageKey: string | null = null
    try {
      const url = new URL(doc.file_url)
      const prefix = '/storage/v1/object/public/documents/'
      if (url.pathname.startsWith(prefix)) {
        storageKey = decodeURIComponent(url.pathname.slice(prefix.length))
      }
    } catch {
      const m = doc.file_url.match(/\/storage\/v1\/object\/(?:public|sign)\/documents\/(.+)$/)
      storageKey = m ? decodeURIComponent(m[1]) : null
    }
    if (!storageKey) return new Response('Invalid file URL', { status: 500 })

    const serviceSupabase = createServiceClient()
    const { data: fileData, error: downloadError } = await serviceSupabase.storage
      .from('documents')
      .download(storageKey)
    if (downloadError || !fileData) {
      return new Response('파일을 가져올 수 없습니다.', { status: 500 })
    }

    const pdfBase64 = Buffer.from(await fileData.arrayBuffer()).toString('base64')
    const claudeStream = streamSummaryWithPdfVision(pdfBase64, style)

    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          for await (const event of claudeStream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(event.delta.text))
            }
          }
          // Image analysis results are ephemeral — do not overwrite the cached text summary
        } catch (e) {
          console.error('PDF Vision summarize error:', e)
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readableStream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  // ── Standard text-based path ────────────────────────────────────────────────

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

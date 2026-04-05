import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { streamAnswer } from '@/lib/documents/ai'

const FREE_QUESTION_LIMIT = 5

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { question, history = [] } = await request.json() as {
    question: string
    history?: { role: 'user' | 'assistant'; content: string }[]
  }
  if (!question?.trim()) return new Response('Question is required', { status: 400 })

  // Verify document ownership
  const { data: doc } = await supabase
    .from('documents')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!doc) return new Response('Not found', { status: 404 })

  // Check question limit (free users)
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .single()
  const isPro = sub?.plan === 'pro' && sub?.status === 'active'

  if (!isPro) {
    const { count } = await supabase
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', id)
      .eq('user_id', user.id)
    if ((count ?? 0) >= FREE_QUESTION_LIMIT) {
      return new Response(
        `무료 플랜은 문서당 ${FREE_QUESTION_LIMIT}회까지만 질문할 수 있습니다.`,
        { status: 429 }
      )
    }
  }

  // Keyword-based chunk retrieval
  const { data: chunks } = await supabase
    .from('chunks')
    .select('content, chunk_index')
    .eq('document_id', id)
    .order('chunk_index')

  const allChunks = (chunks ?? []).map(c => c.content)

  if (allChunks.length === 0) {
    return new Response('문서 내용을 찾을 수 없습니다. 문서를 다시 업로드해주세요.', { status: 422 })
  }

  // Simple keyword matching to find relevant chunks
  const words = question.toLowerCase().split(/\s+/).filter((w: string) => w.length > 1)
  const scored = allChunks.map((content, i) => {
    const lower = content.toLowerCase()
    const score = words.reduce((acc: number, word: string) => acc + (lower.includes(word) ? 1 : 0), 0)
    return { content, score, index: i }
  })
  scored.sort((a, b) => b.score - a.score)

  // Use top 5 relevant chunks; if no keyword match, fall back to first 5 chunks
  const topChunks = scored.slice(0, 5).filter(c => c.score > 0)
  const contextChunks = topChunks.length > 0
    ? topChunks.map(c => c.content)
    : allChunks.slice(0, 5)

  // Stream from Claude — include last 20 messages (10 Q&A pairs) for context continuity
  const claudeStream = streamAnswer(question, contextChunks, history.slice(-20))
  let fullAnswer = ''

  const readableStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        for await (const event of claudeStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const text = event.delta.text
            fullAnswer += text
            controller.enqueue(encoder.encode(text))
          }
        }
        // Save conversation
        await supabase.from('conversations').insert({
          document_id: id,
          user_id: user.id,
          question,
          answer: fullAnswer,
        })
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

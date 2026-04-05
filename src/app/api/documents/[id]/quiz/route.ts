import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateQuiz, QuizDifficulty, QuizType } from '@/lib/documents/ai'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: quizzes } = await supabase
    .from('quizzes')
    .select('id, settings, created_at, quiz_results(score, total, completed_at)')
    .eq('document_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return Response.json(quizzes ?? [])
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Pro-only feature
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .single()
  const isPro = sub?.plan === 'pro' && sub?.status === 'active'
  if (!isPro) {
    return new Response('퀴즈 기능은 Pro 전용입니다.', { status: 403 })
  }

  // Verify document ownership
  const { data: doc } = await supabase
    .from('documents')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!doc) return new Response('Not found', { status: 404 })

  const body = await request.json() as { count?: number; difficulty?: QuizDifficulty; type?: QuizType }
  const count = Math.min(Math.max(body.count ?? 10, 5), 20)
  const difficulty: QuizDifficulty = body.difficulty ?? 'medium'
  const type: QuizType = body.type ?? 'mixed'

  // Fetch all chunks as document content
  const { data: chunks } = await supabase
    .from('chunks')
    .select('content, chunk_index')
    .eq('document_id', id)
    .order('chunk_index')

  const fullText = (chunks ?? []).map(c => c.content).join('\n\n')
  if (!fullText) return new Response('문서 내용을 찾을 수 없습니다.', { status: 422 })

  const questions = await generateQuiz(fullText, count, difficulty, type)
  if (!questions.length) return new Response('퀴즈 생성에 실패했습니다.', { status: 500 })

  const { data: quiz, error } = await supabase
    .from('quizzes')
    .insert({
      document_id: id,
      user_id: user.id,
      settings: { count, difficulty, type },
      questions,
    })
    .select()
    .single()

  if (error) return new Response('저장에 실패했습니다.', { status: 500 })
  return Response.json(quiz)
}

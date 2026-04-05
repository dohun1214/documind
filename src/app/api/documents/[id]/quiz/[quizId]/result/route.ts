import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; quizId: string }> }
) {
  const { quizId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = await request.json() as {
    score: number
    total: number
    answers: Record<number, { userAnswer: string; correct: boolean }>
  }

  const { data, error } = await supabase
    .from('quiz_results')
    .insert({
      quiz_id: quizId,
      user_id: user.id,
      score: body.score,
      total: body.total,
      answers: body.answers,
    })
    .select()
    .single()

  if (error) return new Response('저장에 실패했습니다.', { status: 500 })
  return Response.json(data)
}

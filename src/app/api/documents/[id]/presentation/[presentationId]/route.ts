import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; presentationId: string }> }
) {
  const { presentationId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data } = await supabase
    .from('presentations')
    .select('*')
    .eq('id', presentationId)
    .eq('user_id', user.id)
    .single()

  if (!data) return new Response('Not found', { status: 404 })
  return Response.json(data)
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get file_url first
  const { data: doc } = await supabase
    .from('documents')
    .select('file_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const serviceSupabase = createServiceClient()

  // Extract storage key from URL
  const url = new URL(doc.file_url)
  const storagePath = url.pathname.split('/documents/')[1]
  if (storagePath) {
    await serviceSupabase.storage.from('documents').remove([storagePath])
  }

  await supabase.from('documents').delete().eq('id', id)

  return NextResponse.json({ success: true })
}

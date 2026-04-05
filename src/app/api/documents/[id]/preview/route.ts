import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const CONTENT_TYPES: Record<string, string> = {
  png:  'image/png',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  // Get document — enforces ownership via RLS
  const { data: doc, error } = await supabase
    .from('documents')
    .select('file_url, file_type')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !doc) return new NextResponse('Not found', { status: 404 })
  if (doc.file_type !== 'image') return new NextResponse('Not an image', { status: 400 })

  // Extract storage key from the public URL
  const url = new URL(doc.file_url)
  const storageKey = decodeURIComponent(
    url.pathname.slice('/storage/v1/object/public/documents/'.length)
  )

  const serviceSupabase = createServiceClient()
  const { data: fileData, error: downloadError } = await serviceSupabase.storage
    .from('documents')
    .download(storageKey)

  if (downloadError || !fileData) {
    return new NextResponse('File not found', { status: 404 })
  }

  const ext = storageKey.split('.').pop()?.toLowerCase() ?? 'jpeg'
  const contentType = CONTENT_TYPES[ext] ?? 'image/jpeg'

  const arrayBuffer = await fileData.arrayBuffer()
  return new NextResponse(arrayBuffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}

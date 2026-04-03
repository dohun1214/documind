import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { extractPdf, extractDocx, splitIntoChunks } from '@/lib/documents/extract'
import { generateSummary, generateKeyPoints } from '@/lib/documents/ai'

const FREE_DAILY_LIMIT = 3
const FREE_PAGE_LIMIT = 10

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check subscription
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .single()
  const isPro = sub?.plan === 'pro' && sub?.status === 'active'

  // Daily limit check (free users)
  if (!isPro) {
    const today = new Date().toISOString().split('T')[0]
    const { count } = await supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', today)
    if ((count ?? 0) >= FREE_DAILY_LIMIT) {
      return NextResponse.json(
        { error: `무료 플랜은 하루 ${FREE_DAILY_LIMIT}개까지만 업로드할 수 있습니다.` },
        { status: 429 }
      )
    }
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext !== 'pdf' && ext !== 'docx') {
    return NextResponse.json({ error: 'PDF 또는 DOCX 파일만 지원합니다.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  // Extract text
  let extracted
  try {
    extracted = ext === 'pdf'
      ? await extractPdf(buffer)
      : await extractDocx(buffer)
  } catch (e) {
    console.error('Text extraction error:', e)
    return NextResponse.json({ error: '파일에서 텍스트를 추출할 수 없습니다. 파일이 손상되었거나 지원하지 않는 형식입니다.' }, { status: 422 })
  }

  if (!extracted.text.trim()) {
    return NextResponse.json({ error: '문서에서 텍스트를 찾을 수 없습니다. 이미지 기반 PDF나 빈 문서는 지원하지 않습니다.' }, { status: 422 })
  }

  // Page limit check (free users)
  if (!isPro && extracted.pageCount > FREE_PAGE_LIMIT) {
    return NextResponse.json(
      { error: `무료 플랜은 ${FREE_PAGE_LIMIT}페이지 이하 문서만 지원합니다. (현재: ${extracted.pageCount}페이지)` },
      { status: 400 }
    )
  }

  // Sanitize filename: Supabase Storage rejects non-ASCII characters
  const baseName = file.name.replace(/\.[^.]+$/, '')
  const safeName = (
    baseName.replace(/[^\x00-\x7F]/g, '').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '_') || 'document'
  ) + `.${ext}`
  // Upload file to Supabase Storage
  const storageKey = `${user.id}/${Date.now()}_${safeName}`
  const serviceSupabase = createServiceClient()
  const contentType = file.type ||
    (ext === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  const { error: uploadError } = await serviceSupabase.storage
    .from('documents')
    .upload(storageKey, buffer, { contentType })

  if (uploadError) {
    return NextResponse.json({ error: `파일 저장 실패: ${uploadError.message}` }, { status: 500 })
  }

  const { data: { publicUrl } } = serviceSupabase.storage
    .from('documents')
    .getPublicUrl(storageKey)

  // Create document record (status: processing)
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .insert({
      user_id: user.id,
      title: file.name.replace(/\.[^.]+$/, ''),
      file_url: publicUrl,
      file_type: ext,
      file_size: file.size,
      page_count: extracted.pageCount,
      char_count: extracted.charCount,
      status: 'processing',
    })
    .select()
    .single()

  if (docError || !doc) {
    return NextResponse.json({ error: '문서 생성 실패' }, { status: 500 })
  }

  // Save chunks
  const chunks = splitIntoChunks(extracted.text)
  const chunkRows = chunks.map((content, i) => ({
    document_id: doc.id,
    chunk_index: i,
    content,
  }))

  const { error: chunksError } = await serviceSupabase.from('chunks').insert(chunkRows)
  if (chunksError) {
    console.error('Chunks insert error:', chunksError)
  }
  console.log(`Inserted ${chunkRows.length} chunks for document ${doc.id}`)

  // Generate summary + key points (async, non-blocking response)
  // We respond immediately and process in background
  ;(async () => {
    try {
      const [summary, keyPoints] = await Promise.all([
        generateSummary(extracted.text),
        generateKeyPoints(extracted.text),
      ])
      await serviceSupabase
        .from('documents')
        .update({ summary, key_points: keyPoints, status: 'ready', updated_at: new Date().toISOString() })
        .eq('id', doc.id)
    } catch (e) {
      console.error('AI processing error:', e)
      await serviceSupabase
        .from('documents')
        .update({ status: 'error', updated_at: new Date().toISOString() })
        .eq('id', doc.id)
    }
  })()

  return NextResponse.json({ id: doc.id, status: 'processing' })
}

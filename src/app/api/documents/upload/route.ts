import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { extractPdf, extractDocx, extractDocxWithImages, extractImage, splitIntoChunks } from '@/lib/documents/extract'
import { generateSummary, generateKeyPoints, generateRecommendedQuestions, analyzePdfWithVision } from '@/lib/documents/ai'

const FREE_DAILY_LIMIT = 3
const FREE_PAGE_LIMIT = 10

const SUPPORTED_EXTS = new Set(['pdf', 'docx', 'png', 'jpg', 'jpeg', 'webp'])
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp'])

const CONTENT_TYPES: Record<string, string> = {
  pdf:  'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  png:  'image/png',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

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

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!SUPPORTED_EXTS.has(ext)) {
    return NextResponse.json(
      { error: 'PDF, DOCX, PNG, JPG, WEBP 파일만 지원합니다.' },
      { status: 400 }
    )
  }

  const isImage = IMAGE_EXTS.has(ext)
  const fileType = isImage ? 'image' : ext   // 'pdf' | 'docx' | 'image'

  const buffer = Buffer.from(await file.arrayBuffer())

  // ── Text extraction ────────────────────────────────────────────────────────
  let extracted
  try {
    if (isImage) {
      // Direct Vision OCR for image files
      extracted = await extractImage(buffer, ext)
    } else if (ext === 'pdf') {
      extracted = await extractPdf(buffer)

      // Image-based (scanned) PDF: fall back to Claude PDF Vision OCR
      if (extracted.isImageBased) {
        console.log(`Image-based PDF detected for ${file.name}, running Vision OCR`)
        try {
          const pdfBase64 = buffer.toString('base64')
          const ocrText = await analyzePdfWithVision(pdfBase64)
          if (ocrText.trim()) {
            extracted = {
              text: ocrText,
              pageCount: extracted.pageCount,
              charCount: ocrText.length,
            }
          }
        } catch (ocrErr) {
          console.error('PDF Vision OCR error:', ocrErr)
          // Keep whatever text pdf-parse found (may be empty)
        }
      }
    } else {
      // DOCX with embedded image analysis
      extracted = await extractDocxWithImages(buffer)
      // Fallback to basic extraction if image-enhanced fails
      if (!extracted.text.trim()) {
        extracted = await extractDocx(buffer)
      }
    }
  } catch (e) {
    console.error('Text extraction error:', e)
    return NextResponse.json(
      { error: '파일에서 텍스트를 추출할 수 없습니다. 파일이 손상되었거나 지원하지 않는 형식입니다.' },
      { status: 422 }
    )
  }

  if (!extracted.text.trim()) {
    return NextResponse.json(
      { error: '문서에서 텍스트를 찾을 수 없습니다. 이미지 기반 PDF나 빈 문서는 지원하지 않습니다.' },
      { status: 422 }
    )
  }

  // Page limit check for free users (not applicable to single images)
  if (!isPro && !isImage && extracted.pageCount > FREE_PAGE_LIMIT) {
    return NextResponse.json(
      { error: `무료 플랜은 ${FREE_PAGE_LIMIT}페이지 이하 문서만 지원합니다. (현재: ${extracted.pageCount}페이지)` },
      { status: 400 }
    )
  }

  // ── Storage upload ─────────────────────────────────────────────────────────
  const baseName = file.name.replace(/\.[^.]+$/, '')
  const safeName = (
    baseName.replace(/[^\x00-\x7F]/g, '').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '_') || 'document'
  ) + `.${ext}`
  const storageKey = `${user.id}/${Date.now()}_${safeName}`
  const serviceSupabase = createServiceClient()
  const contentType = file.type || CONTENT_TYPES[ext] || 'application/octet-stream'

  const { error: uploadError } = await serviceSupabase.storage
    .from('documents')
    .upload(storageKey, buffer, { contentType })
  if (uploadError) {
    return NextResponse.json({ error: `파일 저장 실패: ${uploadError.message}` }, { status: 500 })
  }

  const { data: { publicUrl } } = serviceSupabase.storage
    .from('documents')
    .getPublicUrl(storageKey)

  // ── Document record ────────────────────────────────────────────────────────
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .insert({
      user_id: user.id,
      title: file.name.replace(/\.[^.]+$/, ''),
      file_url: publicUrl,
      file_type: fileType,
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

  // ── Save chunks ────────────────────────────────────────────────────────────
  const chunks = splitIntoChunks(extracted.text)
  const chunkRows = chunks.map((content, i) => ({
    document_id: doc.id,
    chunk_index: i,
    content,
  }))
  const { error: chunksError } = await serviceSupabase.from('chunks').insert(chunkRows)
  if (chunksError) console.error('Chunks insert error:', chunksError)

  // ── AI processing (non-blocking) ──────────────────────────────────────────
  ;(async () => {
    try {
      const [summary, keyPoints, recommendedQuestions] = await Promise.all([
        generateSummary(extracted.text),
        generateKeyPoints(extracted.text),
        generateRecommendedQuestions(extracted.text),
      ])
      await serviceSupabase
        .from('documents')
        .update({
          summary,
          key_points: keyPoints,
          recommended_questions: recommendedQuestions.length > 0 ? recommendedQuestions : null,
          status: 'ready',
          updated_at: new Date().toISOString(),
        })
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

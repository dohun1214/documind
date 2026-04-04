import { NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { translateDocxParagraphs } from '@/lib/documents/ai'
import JSZip from 'jszip'

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function decodeXml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Pro only
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .single()
  const isPro = sub?.plan === 'pro' && sub?.status === 'active'
  if (!isPro) {
    return new Response('번역 기능은 Pro 플랜 전용입니다.', { status: 403 })
  }

  const { direction } = await request.json() as { direction: 'ko-en' | 'en-ko' }
  if (direction !== 'ko-en' && direction !== 'en-ko') {
    return new Response('direction must be ko-en or en-ko', { status: 400 })
  }

  // Get document with ownership check
  const { data: doc } = await supabase
    .from('documents')
    .select('id, file_url, file_type')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!doc) return new Response('Not found', { status: 404 })
  if (doc.file_type !== 'docx') {
    return new Response('DOCX 파일만 지원합니다.', { status: 400 })
  }

  // Extract storage key from file_url
  // Format: https://{project}.supabase.co/storage/v1/object/public/documents/{key}
  let storageKey: string | null = null
  try {
    const url = new URL(doc.file_url)
    const prefix = '/storage/v1/object/public/documents/'
    if (url.pathname.startsWith(prefix)) {
      storageKey = decodeURIComponent(url.pathname.slice(prefix.length))
    }
  } catch {
    // fallback regex
    const m = doc.file_url.match(/\/storage\/v1\/object\/(?:public|sign)\/documents\/(.+)$/)
    storageKey = m ? decodeURIComponent(m[1]) : null
  }

  if (!storageKey) return new Response('Invalid file URL', { status: 500 })

  // Download file from Supabase Storage using service role
  const serviceSupabase = createServiceClient()
  const { data: fileData, error: downloadError } = await serviceSupabase.storage
    .from('documents')
    .download(storageKey)

  if (downloadError || !fileData) {
    console.error('Storage download error:', downloadError)
    return new Response('파일을 가져올 수 없습니다.', { status: 500 })
  }

  // Translate the DOCX
  let translatedBuffer: Buffer
  try {
    const buffer = Buffer.from(await fileData.arrayBuffer())
    translatedBuffer = await translateDocx(buffer, direction)
  } catch (e) {
    console.error('DOCX translation error:', e)
    return new Response('번역에 실패했습니다.', { status: 500 })
  }

  return new Response(new Uint8Array(translatedBuffer), {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': 'attachment; filename="translated.docx"',
    },
  })
}

async function translateDocx(
  buffer: Buffer,
  direction: 'ko-en' | 'en-ko'
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer)
  const xmlFile = zip.file('word/document.xml')
  if (!xmlFile) throw new Error('word/document.xml not found in DOCX')

  const xmlContent = await xmlFile.async('string')

  // Collect all <w:p> paragraph XML strings in order
  const paraMatches: string[] = []
  xmlContent.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (m) => {
    paraMatches.push(m)
    return m
  })

  // For each paragraph, extract combined text and track which need translation
  type ParaInfo = { text: string; translatedIdx: number | null }
  const paraInfos: ParaInfo[] = []
  let translateCount = 0

  for (const paraXml of paraMatches) {
    const parts: string[] = []
    for (const t of paraXml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)) {
      parts.push(decodeXml(t[1]))
    }
    const text = parts.join('')
    if (text.trim()) {
      paraInfos.push({ text, translatedIdx: translateCount++ })
    } else {
      paraInfos.push({ text, translatedIdx: null })
    }
  }

  // Batch translate non-empty paragraphs
  const textsToTranslate = paraInfos
    .filter(p => p.translatedIdx !== null)
    .map(p => p.text)

  const translated = await translateDocxParagraphs(textsToTranslate, direction)

  // Rebuild XML: replace <w:t> contents in each paragraph
  let pCounter = 0
  const resultXml = xmlContent.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (paraXml) => {
    const info = paraInfos[pCounter++]
    if (info === undefined || info.translatedIdx === null) return paraXml

    const translatedText = translated[info.translatedIdx] ?? info.text

    // Put full translated text in the first <w:t>, clear the rest
    let isFirst = true
    return paraXml.replace(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g, () => {
      if (isFirst) {
        isFirst = false
        return `<w:t xml:space="preserve">${escapeXml(translatedText)}</w:t>`
      }
      return '<w:t></w:t>'
    })
  })

  zip.file('word/document.xml', resultXml)
  const result = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  return result as unknown as Buffer
}

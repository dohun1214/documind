/**
 * Text extraction from PDF and DOCX files.
 * These run server-side only.
 */

import { createRequire } from 'module'
import { analyzeImageWithVision } from './ai'

// createRequire binds CJS require to this ESM module — required for Turbopack
// to correctly resolve CJS packages marked in serverExternalPackages.
const _require = createRequire(import.meta.url)

export interface ExtractResult {
  text: string
  pageCount: number
  charCount: number
  /** true when the PDF had no selectable text (scanned/image-based) */
  isImageBased?: boolean
}

export function splitIntoChunks(text: string, chunkSize = 2000): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    // Try to break at paragraph or sentence boundary
    let end = Math.min(start + chunkSize, text.length)
    if (end < text.length) {
      const boundary = text.lastIndexOf('\n\n', end)
      if (boundary > start + chunkSize / 2) end = boundary + 2
      else {
        const sentEnd = text.lastIndexOf('. ', end)
        if (sentEnd > start + chunkSize / 2) end = sentEnd + 2
      }
    }
    const chunk = text.slice(start, end).trim()
    if (chunk) chunks.push(chunk)
    start = end
  }
  return chunks
}

type PdfParseFn = (buf: Buffer) => Promise<{ text: string; numpages: number }>

/** Extract selectable text from a PDF. Sets isImageBased when text is too short. */
export async function extractPdf(buffer: Buffer): Promise<ExtractResult> {
  // Use createRequire-bound require to correctly load CJS-only pdf-parse
  // under Turbopack's ESM server runtime (next.js 16+).
  // pdf-parse/lib/pdf-parse.js bypasses the problematic index.js debug-mode
  // check that fires when module.parent is undefined in newer Node.js.
  const pdfParse = _require('pdf-parse/lib/pdf-parse.js') as PdfParseFn
  const data = await pdfParse(buffer)
  const isImageBased = data.text.trim().length < 100 && data.numpages > 0
  return {
    text: data.text,
    pageCount: data.numpages,
    charCount: data.text.length,
    isImageBased,
  }
}

/** Extract text from a DOCX, including AI analysis of embedded images. */
export async function extractDocx(buffer: Buffer): Promise<ExtractResult> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  const text = result.value
  // Estimate page count: ~3000 chars per page
  const pageCount = Math.max(1, Math.ceil(text.length / 3000))
  return {
    text,
    pageCount,
    charCount: text.length,
  }
}

/** MIME types recognised as images for Vision analysis */
const IMAGE_MEDIA_TYPES: Record<string, 'image/png' | 'image/jpeg' | 'image/webp'> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

/**
 * Extract DOCX text + analyze any embedded images in word/media/.
 * Image descriptions are appended after the main text.
 * Limits analysis to the first 5 images to avoid excessive latency.
 */
export async function extractDocxWithImages(buffer: Buffer): Promise<ExtractResult> {
  const [mammoth, JSZip] = await Promise.all([
    import('mammoth'),
    import('jszip').then(m => m.default),
  ])

  // Extract text via mammoth
  const textResult = await mammoth.extractRawText({ buffer })
  let text = textResult.value

  // Extract embedded images from word/media/
  try {
    const zip = await JSZip.loadAsync(buffer)
    const mediaFiles: { name: string; ext: string; file: import('jszip').JSZipObject }[] = []

    zip.folder('word/media')?.forEach((relativePath, file) => {
      if (file.dir) return
      const ext = relativePath.split('.').pop()?.toLowerCase() ?? ''
      if (IMAGE_MEDIA_TYPES[ext]) {
        mediaFiles.push({ name: relativePath, ext, file })
      }
    })

    // Limit to first 5 images
    const toAnalyze = mediaFiles.slice(0, 5)

    if (toAnalyze.length > 0) {
      const imageDescriptions = await Promise.all(
        toAnalyze.map(async ({ ext, file }, idx) => {
          const imgBuffer = await file.async('nodebuffer')
          const base64 = imgBuffer.toString('base64')
          const mediaType = IMAGE_MEDIA_TYPES[ext]
          try {
            const description = await analyzeImageWithVision(base64, mediaType)
            return `[이미지 분석 ${idx + 1}]\n${description}`
          } catch {
            return null
          }
        })
      )

      const validDescriptions = imageDescriptions.filter(Boolean)
      if (validDescriptions.length > 0) {
        text = text + '\n\n---\n\n' + validDescriptions.join('\n\n')
      }
    }
  } catch (e) {
    // If image extraction fails, fall back to text-only result
    console.error('DOCX image extraction error:', e)
  }

  const pageCount = Math.max(1, Math.ceil(text.length / 3000))
  return {
    text,
    pageCount,
    charCount: text.length,
  }
}

/**
 * Analyze an image file with Claude Vision.
 * Returns full analysis text including OCR'd content.
 */
export async function extractImage(
  buffer: Buffer,
  ext: string
): Promise<ExtractResult> {
  const mediaType = IMAGE_MEDIA_TYPES[ext.toLowerCase()]
  if (!mediaType) throw new Error(`지원하지 않는 이미지 형식: ${ext}`)

  const base64 = buffer.toString('base64')
  const text = await analyzeImageWithVision(base64, mediaType)

  return {
    text,
    pageCount: 1,
    charCount: text.length,
  }
}

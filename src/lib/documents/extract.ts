/**
 * Text extraction from PDF and DOCX files.
 * These run server-side only.
 */

export interface ExtractResult {
  text: string
  pageCount: number
  charCount: number
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

export async function extractPdf(buffer: Buffer): Promise<ExtractResult> {
  // pdf-parse@1.x exports a function directly (CJS); use require for reliability with Turbopack
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as PdfParseFn
  const data = await pdfParse(buffer)
  return {
    text: data.text,
    pageCount: data.numpages,
    charCount: data.text.length,
  }
}

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

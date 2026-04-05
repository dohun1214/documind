/**
 * Text extraction from PDF and DOCX files.
 * These run server-side only.
 */

import { createRequire } from 'module'

// createRequire binds CJS require to this ESM module — required for Turbopack
// to correctly resolve CJS packages marked in serverExternalPackages.
const _require = createRequire(import.meta.url)

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
  // Use createRequire-bound require to correctly load CJS-only pdf-parse
  // under Turbopack's ESM server runtime (next.js 16+).
  // pdf-parse/lib/pdf-parse.js bypasses the problematic index.js debug-mode
  // check that fires when module.parent is undefined in newer Node.js.
  const pdfParse = _require('pdf-parse/lib/pdf-parse.js') as PdfParseFn
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

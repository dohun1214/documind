import Anthropic from '@anthropic-ai/sdk'
import type { DocumentBlockParam } from '@anthropic-ai/sdk/resources/messages/messages.js'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = 'claude-sonnet-4-20250514'
const MAX_CONTEXT = 80000 // ~60k tokens worth of chars

const SYSTEM_PROMPT =
  '너는 DocuMind AI 어시스턴트야. ' +
  '너의 이름은 DocuMind AI이고, 문서 분석 전문 AI야. ' +
  '절대로 Claude, Anthropic, OpenAI, GPT 등 AI 모델이나 회사 이름을 언급하지 마. ' +
  '너가 어떤 AI 모델인지 물어보면 \'DocuMind AI 어시스턴트입니다\'라고만 답해. ' +
  '너를 만든 회사에 대해 물어보면 \'DocuMind 팀에서 개발했습니다\'라고 답해. ' +
  '인사말이나 자기소개를 하지 마. 질문에 대해 바로 답변해. ' +
  '간결하고 명확하게 답변하되, 불필요한 서두 없이 핵심부터 시작해.'

function truncate(text: string, max = MAX_CONTEXT): string {
  if (text.length <= max) return text
  return text.slice(0, max) + '\n\n[... 문서가 너무 길어 일부 생략됨]'
}

export async function generateSummary(fullText: string): Promise<string> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `다음 문서를 한국어로 요약해주세요. 구조화된 형식(##제목, 단락 구분)으로 핵심 내용을 중심으로 작성해주세요.

문서:
${truncate(fullText)}`,
      },
    ],
  })
  return message.content[0].type === 'text' ? message.content[0].text : ''
}

export async function generateKeyPoints(fullText: string): Promise<string[]> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `다음 문서에서 핵심 포인트 5~10개를 추출해주세요. JSON 배열 형식으로만 응답하세요. 예: ["포인트1", "포인트2"]

문서:
${truncate(fullText, 40000)}`,
      },
    ],
  })
  const text = message.content[0].type === 'text' ? message.content[0].text : '[]'
  try {
    const match = text.match(/\[[\s\S]*\]/)
    return match ? JSON.parse(match[0]) : []
  } catch {
    return []
  }
}

export type SummaryStyle = 'detailed' | 'brief' | 'oneliner' | 'simple' | 'expert'

const STYLE_PROMPTS: Record<SummaryStyle, string> = {
  detailed: '구조화된 형식(## 제목, 단락 구분)으로 핵심 내용을 중심으로 요약해줘.',
  brief: '3~5문장으로 핵심만 간단히 요약해줘. 불필요한 세부 사항은 생략해.',
  oneliner: '이 문서의 핵심을 단 한 문장으로 요약해줘.',
  simple: '초등학생도 이해할 수 있는 쉬운 말로 설명해줘. 어려운 용어는 쉬운 표현으로 바꿔.',
  expert: '전문 용어를 유지하면서 주요 논점, 방법론, 한계점을 포함한 비판적 분석을 제공해줘.',
}

export function streamSummaryWithStyle(fullText: string, style: SummaryStyle) {
  return client.messages.stream({
    model: MODEL,
    max_tokens: style === 'oneliner' ? 256 : 2048,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `다음 문서를 한국어로 요약해줘. ${STYLE_PROMPTS[style]}\n\n문서:\n${truncate(fullText)}`,
    }],
  })
}

type HistoryMsg = { role: 'user' | 'assistant'; content: string }

export function streamAnswer(
  question: string,
  contextChunks: string[],
  history: HistoryMsg[] = []
) {
  const context = contextChunks.join('\n\n---\n\n')
  // Inject document context into system prompt so message history stays clean
  const sysWithCtx =
    SYSTEM_PROMPT +
    `\n\n[문서 참고 내용 — 이 내용을 기반으로 모든 질문에 답변하세요]\n\n${truncate(context, 30000)}`

  return client.messages.stream({
    model: MODEL,
    max_tokens: 2048,
    system: sysWithCtx,
    messages: [
      ...history,
      { role: 'user' as const, content: question },
    ],
  })
}

export async function generateRecommendedQuestions(fullText: string): Promise<string[]> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `다음 문서를 읽고, 독자가 이 문서에 대해 물어볼 만한 흥미롭고 유익한 질문 5개를 생성해줘.
질문은 문서 내용을 깊이 이해하는 데 도움이 되어야 해.
JSON 배열 형식으로만 응답해. 예: ["질문1", "질문2", "질문3", "질문4", "질문5"]

문서:
${truncate(fullText, 40000)}`,
    }],
  })
  const text = message.content[0].type === 'text' ? message.content[0].text : '[]'
  try {
    const match = text.match(/\[[\s\S]*\]/)
    const parsed: unknown[] = match ? JSON.parse(match[0]) : []
    return parsed.filter((q): q is string => typeof q === 'string')
  } catch {
    return []
  }
}

export function streamTranslation(fullText: string, direction: 'ko-en' | 'en-ko') {
  const [from, to] = direction === 'ko-en' ? ['한국어', '영어'] : ['영어', '한국어']
  return client.messages.stream({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `다음 ${from} 문서를 ${to}로 번역해주세요.

번역 규칙:
- 원본 문서의 구조를 최대한 유지하며 번역하세요.
- 제목은 마크다운 제목(## 제목)으로, 리스트는 리스트(- 항목)로, 표는 마크다운 표(| col1 | col2 |) 형식으로 표현하세요.
- 자연스럽고 정확한 번역을 제공하세요.

문서:
${truncate(fullText, 60000)}`,
      },
    ],
  })
}

export async function translateDocxParagraphs(
  paragraphs: string[],
  direction: 'ko-en' | 'en-ko'
): Promise<string[]> {
  if (!paragraphs.length) return []
  const [from, to] = direction === 'ko-en' ? ['한국어', '영어'] : ['영어', '한국어']
  const BATCH = 30
  const results: string[] = []

  for (let i = 0; i < paragraphs.length; i += BATCH) {
    const batch = paragraphs.slice(i, i + BATCH)
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `다음 ${from} 텍스트 배열을 ${to}로 번역하세요.
JSON 배열 형식으로만 응답하세요. 입력과 동일한 개수(${batch.length}개)를 유지하세요.
각 항목의 원본 구조를 최대한 유지하며 자연스럽게 번역하세요.
오직 JSON 배열만 응답하세요.

입력:
${JSON.stringify(batch)}`,
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : '[]'
    try {
      const match = text.match(/\[[\s\S]*\]/)
      const parsed: string[] = match ? JSON.parse(match[0]) : []
      for (let j = 0; j < batch.length; j++) {
        results.push(typeof parsed[j] === 'string' ? parsed[j] : batch[j])
      }
    } catch {
      results.push(...batch)
    }
  }

  return results
}

export function streamSummary(fullText: string) {
  return client.messages.stream({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `다음 문서를 한국어로 요약해주세요. 구조화된 형식(## 제목, 단락 구분)으로 핵심 내용을 중심으로 작성해주세요.

문서:
${truncate(fullText)}`,
      },
    ],
  })
}

// ─── Vision API ──────────────────────────────────────────────────────────────

/**
 * Analyze a single image with Claude Vision.
 * Returns a detailed description and any extracted text.
 */
export async function analyzeImageWithVision(
  imageBase64: string,
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp'
): Promise<string> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: imageBase64 },
        },
        {
          type: 'text',
          text: '이 이미지의 내용을 상세히 분석하고 설명해줘. 텍스트가 있으면 모두 정확하게 추출해줘. 표가 있으면 마크다운 표 형식으로 정리해줘. 그래프나 차트가 있으면 수치와 내용을 설명해줘.',
        },
      ],
    }],
  })
  return message.content[0].type === 'text' ? message.content[0].text : ''
}

/**
 * OCR an image-based (scanned) PDF using Claude's native document understanding.
 * Uses the document content block which accepts PDF binary as base64.
 */
export async function analyzePdfWithVision(pdfBase64: string): Promise<string> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: pdfBase64,
          },
        } as DocumentBlockParam,
        {
          type: 'text',
          text: '이 PDF 문서의 모든 텍스트를 정확하게 추출해줘. 표가 있으면 마크다운 표 형식으로, 목록은 리스트 형식으로 구조를 유지하면서 모든 내용을 추출해줘.',
        },
      ],
    }],
  })
  return message.content[0].type === 'text' ? message.content[0].text : ''
}

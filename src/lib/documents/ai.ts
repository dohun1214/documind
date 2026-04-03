import Anthropic from '@anthropic-ai/sdk'

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

export function streamAnswer(question: string, contextChunks: string[]) {
  const context = contextChunks.join('\n\n---\n\n')
  return client.messages.stream({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `다음은 문서의 관련 내용입니다:

${truncate(context, 40000)}

---
위 내용을 바탕으로 다음 질문에 한국어로 답변해주세요:
${question}`,
      },
    ],
  })
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
        content: `다음 ${from} 문서를 ${to}로 번역해주세요. 원문의 구조와 형식을 최대한 유지하고 자연스러운 번역을 제공해주세요.

문서:
${truncate(fullText, 60000)}`,
      },
    ],
  })
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

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PrintTrigger } from './PrintTrigger'

interface Props {
  params: Promise<{ id: string }>
}

/** Very small markdown → plain text converter for print output */
function renderMarkdown(text: string) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // h2
    if (/^##\s/.test(line)) {
      elements.push(<h2 key={i}>{line.replace(/^##\s+/, '')}</h2>)
    }
    // h3
    else if (/^###\s/.test(line)) {
      elements.push(<h3 key={i}>{line.replace(/^###\s+/, '')}</h3>)
    }
    // h1
    else if (/^#\s/.test(line)) {
      elements.push(<h1 key={i} style={{ fontSize: '1.25rem', fontWeight: 700, margin: '12px 0 6px' }}>{line.replace(/^#\s+/, '')}</h1>)
    }
    // bullet list item
    else if (/^[-*]\s/.test(line)) {
      elements.push(<li key={i}>{applyInline(line.replace(/^[-*]\s+/, ''))}</li>)
    }
    // empty line → spacer
    else if (line.trim() === '') {
      elements.push(<br key={i} />)
    }
    // normal paragraph
    else {
      elements.push(<p key={i}>{applyInline(line)}</p>)
    }
    i++
  }
  return elements
}

function applyInline(text: string): React.ReactNode {
  // Handle **bold**
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    /^\*\*(.+)\*\*$/.test(part)
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  )
}

export default async function PrintPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Pro check
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .single()
  const isPro = sub?.plan === 'pro' && sub?.status === 'active'
  if (!isPro) redirect('/dashboard/billing')

  const [{ data: doc }, { data: conversations }] = await Promise.all([
    supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('conversations')
      .select('question, answer')
      .eq('document_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (!doc) notFound()

  const date = new Date(doc.created_at).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  const exportDate = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <>
      <PrintTrigger />
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR',
                       -apple-system, sans-serif;
          font-size: 11pt;
          line-height: 1.7;
          color: #1a1a1a;
          background: #fff;
          padding: 0;
        }

        .page {
          max-width: 800px;
          margin: 0 auto;
          padding: 48px 40px;
        }

        /* Header */
        .doc-header {
          border-bottom: 2px solid #4f46e5;
          padding-bottom: 16px;
          margin-bottom: 32px;
        }
        .logo {
          font-size: 13pt;
          font-weight: 700;
          color: #4f46e5;
          letter-spacing: -0.3px;
          margin-bottom: 8px;
        }
        .doc-title {
          font-size: 18pt;
          font-weight: 700;
          color: #111;
          margin-bottom: 4px;
        }
        .doc-meta {
          font-size: 9pt;
          color: #888;
        }

        /* Sections */
        .section { margin-bottom: 32px; }
        .section-title {
          font-size: 13pt;
          font-weight: 700;
          color: #4f46e5;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 6px;
          margin-bottom: 14px;
        }

        /* Body text */
        p { margin-bottom: 6px; }
        h2 { font-size: 12pt; font-weight: 700; margin: 14px 0 4px; }
        h3 { font-size: 11pt; font-weight: 600; margin: 10px 0 4px; }
        li { margin-left: 20px; margin-bottom: 3px; }
        strong { font-weight: 700; }

        /* Key points */
        .keypoints-list { list-style: none; }
        .keypoints-list li {
          display: flex;
          gap: 10px;
          margin-bottom: 10px;
          margin-left: 0;
        }
        .kp-num {
          flex-shrink: 0;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #ede9fe;
          color: #4f46e5;
          font-size: 9pt;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .kp-text { flex: 1; padding-top: 2px; }

        /* Q&A */
        .qa-item { margin-bottom: 18px; }
        .qa-q { font-weight: 700; color: #4f46e5; margin-bottom: 4px; }
        .qa-a { padding-left: 12px; border-left: 2px solid #e5e7eb; }

        /* Footer */
        .doc-footer {
          margin-top: 40px;
          padding-top: 12px;
          border-top: 1px solid #e5e7eb;
          font-size: 8.5pt;
          color: #aaa;
          display: flex;
          justify-content: space-between;
        }

        /* Print overrides */
        @media print {
          body { padding: 0; }
          .page { padding: 20mm 18mm; max-width: none; }
          @page { size: A4; margin: 0; }

          .section { page-break-inside: avoid; }
          .qa-item { page-break-inside: avoid; }
        }

        /* Hide when printing (screen-only notice) */
        .screen-notice {
          background: #f0fdf4;
          border: 1px solid #86efac;
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 24px;
          font-size: 10pt;
          color: #166534;
        }
        @media print { .screen-notice { display: none; } }
      `}</style>

      <div className="page">
        {/* Screen-only notice */}
        <div className="screen-notice">
          인쇄 대화상자가 열립니다. <strong>PDF로 저장</strong>을 선택하면 PDF 파일로 다운로드됩니다.
        </div>

        {/* Header */}
        <div className="doc-header">
          <div className="logo">DocuMind</div>
          <div className="doc-title">{doc.title}</div>
          <div className="doc-meta">업로드: {date} &nbsp;·&nbsp; 내보내기: {exportDate}</div>
        </div>

        {/* Summary */}
        {doc.summary && (
          <div className="section">
            <div className="section-title">문서 요약</div>
            <div className="body-text">{renderMarkdown(doc.summary)}</div>
          </div>
        )}

        {/* Key points */}
        {doc.key_points && doc.key_points.length > 0 && (
          <div className="section">
            <div className="section-title">핵심 포인트</div>
            <ol className="keypoints-list">
              {(doc.key_points as string[]).map((point, i) => (
                <li key={i}>
                  <span className="kp-num">{i + 1}</span>
                  <span className="kp-text">{point}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Q&A */}
        {conversations && conversations.length > 0 && (
          <div className="section">
            <div className="section-title">질의응답 히스토리</div>
            {conversations.map((c, i) => (
              <div key={i} className="qa-item">
                <div className="qa-q">Q. {c.question}</div>
                <div className="qa-a">{renderMarkdown(c.answer)}</div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="doc-footer">
          <span>DocuMind — AI 기반 문서 분석</span>
          <span>{exportDate}</span>
        </div>
      </div>
    </>
  )
}

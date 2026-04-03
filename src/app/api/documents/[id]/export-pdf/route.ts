import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import React from 'react'
import {
  Document, Page, Text, View, StyleSheet, renderToBuffer, Font,
} from '@react-pdf/renderer'

// Register a font with Korean support (Noto Sans KR via Google Fonts CDN)
Font.register({
  family: 'NotoSansKR',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/notosanskr/v36/PbyxFmXiEBPT4ITbgNA5Cgm203Tq4JJWq209pU0DPdWuqxJFA4GNDCBYtw.0.woff2', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/notosanskr/v36/PbyxFmXiEBPT4ITbgNA5Cgm203Tq4JJWq209pU0DPdWuqxJFA4GNDCBYtw.0.woff2', fontWeight: 700 },
  ],
})

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: 'NotoSansKR', fontSize: 10, color: '#1a1a2e', lineHeight: 1.6 },
  header: { marginBottom: 24, borderBottomWidth: 2, borderBottomColor: '#4f46e5', paddingBottom: 12 },
  logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  logo: { fontSize: 16, fontWeight: 700, color: '#4f46e5' },
  docTitle: { fontSize: 14, fontWeight: 700, marginBottom: 2 },
  meta: { fontSize: 8, color: '#6b7280' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: '#4f46e5', marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  bodyText: { fontSize: 9, lineHeight: 1.7, color: '#374151' },
  keyPointItem: { flexDirection: 'row', marginBottom: 5 },
  bullet: { width: 18, fontSize: 9, color: '#4f46e5', fontWeight: 700 },
  keyPointText: { flex: 1, fontSize: 9, lineHeight: 1.7, color: '#374151' },
  qaBubble: { marginBottom: 10 },
  qLabel: { fontSize: 8, fontWeight: 700, color: '#4f46e5', marginBottom: 2 },
  aLabel: { fontSize: 8, fontWeight: 700, color: '#059669', marginBottom: 2 },
  qaText: { fontSize: 9, lineHeight: 1.6, color: '#374151', paddingLeft: 8 },
  footer: { position: 'absolute', bottom: 24, left: 48, right: 48, flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: '#9ca3af', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 6 },
})

type ExportData = {
  title: string
  createdAt: string
  summary: string | null
  keyPoints: string[] | null
  conversations: { question: string; answer: string }[]
}

function PdfDocument({ data }: { data: ExportData }) {
  const date = new Date(data.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  const exported = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

  return React.createElement(
    Document,
    { title: data.title, author: 'DocuMind' },
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      // Header
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(View, { style: styles.logoRow },
          React.createElement(Text, { style: styles.logo }, 'DocuMind')
        ),
        React.createElement(Text, { style: styles.docTitle }, data.title),
        React.createElement(Text, { style: styles.meta }, `업로드: ${date}  |  내보내기: ${exported}`)
      ),
      // Summary
      data.summary
        ? React.createElement(
            View,
            { style: styles.section },
            React.createElement(Text, { style: styles.sectionTitle }, '문서 요약'),
            React.createElement(Text, { style: styles.bodyText }, data.summary.replace(/#{1,6}\s/g, '').replace(/\*\*/g, ''))
          )
        : null,
      // Key Points
      data.keyPoints && data.keyPoints.length > 0
        ? React.createElement(
            View,
            { style: styles.section },
            React.createElement(Text, { style: styles.sectionTitle }, '핵심 포인트'),
            ...data.keyPoints.map((point, i) =>
              React.createElement(
                View,
                { key: i, style: styles.keyPointItem },
                React.createElement(Text, { style: styles.bullet }, `${i + 1}.`),
                React.createElement(Text, { style: styles.keyPointText }, point)
              )
            )
          )
        : null,
      // Q&A
      data.conversations.length > 0
        ? React.createElement(
            View,
            { style: styles.section },
            React.createElement(Text, { style: styles.sectionTitle }, '질의응답 히스토리'),
            ...data.conversations.map((c, i) =>
              React.createElement(
                View,
                { key: i, style: styles.qaBubble },
                React.createElement(Text, { style: styles.qLabel }, 'Q.'),
                React.createElement(Text, { style: styles.qaText }, c.question),
                React.createElement(Text, { style: styles.aLabel }, 'A.'),
                React.createElement(Text, { style: styles.qaText }, c.answer.replace(/#{1,6}\s/g, '').replace(/\*\*/g, ''))
              )
            )
          )
        : null,
      // Footer
      React.createElement(
        View,
        { style: styles.footer, fixed: true },
        React.createElement(Text, null, 'DocuMind — AI 기반 문서 분석'),
        React.createElement(Text, { render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `${pageNumber} / ${totalPages}` }, null)
      )
    )
  )
}

export async function GET(
  _request: NextRequest,
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
    return new Response('PDF 내보내기는 Pro 플랜 전용입니다.', { status: 403 })
  }

  const { data: doc } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!doc) return new Response('Not found', { status: 404 })

  const { data: conversations } = await supabase
    .from('conversations')
    .select('question, answer')
    .eq('document_id', id)
    .order('created_at', { ascending: true })

  const data: ExportData = {
    title: doc.title,
    createdAt: doc.created_at,
    summary: doc.summary,
    keyPoints: doc.key_points,
    conversations: conversations ?? [],
  }

  // Call PdfDocument as a function to get the Document element directly (renderToBuffer expects DocumentProps)
  const buffer = await renderToBuffer(PdfDocument({ data }))

  const safeName = doc.title.replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ\s-]/g, '').trim() || 'document'

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}.pdf`,
    },
  })
}

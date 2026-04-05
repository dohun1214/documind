'use client'

import { useState, useRef, useEffect, CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { UpgradeModal } from '@/components/dashboard/UpgradeModal'
import {
  FileText, FileType, Image, ArrowLeft, Calendar,
  Hash, MessageSquare, Lightbulb, AlignLeft,
  Send, BrainCircuit, Loader2, Trash2, CheckCircle2, Circle,
  Languages, Copy, Check, Download, Zap, Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Document, Conversation } from '@/types'
import { buttonVariants } from '@/lib/button-variants'
import { MarkdownContent } from '@/components/shared/MarkdownContent'

type Tab = 'summary' | 'keypoints' | 'qa' | 'translate'
type TranslateDir = 'ko-en' | 'en-ko'
type SummaryStyle = 'detailed' | 'brief' | 'oneliner' | 'simple' | 'expert'

const STYLE_OPTIONS: { value: SummaryStyle; label: string }[] = [
  { value: 'detailed', label: '상세 요약' },
  { value: 'brief',    label: '간단 요약' },
  { value: 'oneliner', label: '한 줄 요약' },
  { value: 'simple',   label: '쉬운 설명' },
  { value: 'expert',   label: '전문가용' },
]

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

function formatBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface Props {
  document: Document
  initialConversations: Pick<Conversation, 'id' | 'question' | 'answer' | 'created_at'>[]
  isPro: boolean
}

const SUGGESTED_QUESTIONS = [
  '이 문서의 핵심 내용을 간략히 요약해주세요',
  '가장 중요한 수치나 데이터가 무엇인가요?',
  '어떤 결론이나 권고사항이 있나요?',
]

export function DocumentAnalysis({ document: doc, initialConversations, isPro }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('summary')
  const [deleting, setDeleting] = useState(false)
  const [docStatus, setDocStatus] = useState(doc.status ?? 'processing')
  const [summary, setSummary] = useState(doc.summary ?? '')
  const [keyPoints, setKeyPoints] = useState<string[]>(doc.key_points ?? [])
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [keyPointsLoading, setKeyPointsLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialConversations.flatMap(c => [
      { role: 'user' as const, content: c.question },
      { role: 'assistant' as const, content: c.answer },
    ])
  )
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)

  // Summary style
  const [summaryStyle, setSummaryStyle] = useState<SummaryStyle>('detailed')

  // Image-inclusive PDF Vision analysis (Pro + PDF only)
  const [includeImages, setIncludeImages] = useState(false)

  // Recommended / suggested questions from doc
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>(
    doc.recommended_questions ?? []
  )

  // Translation state
  const [translateDir, setTranslateDir] = useState<TranslateDir>('ko-en')
  const [translation, setTranslation] = useState('')
  const [translating, setTranslating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [downloadingTranslation, setDownloadingTranslation] = useState(false)

  // Upgrade modal
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [upgradeHint, setUpgradeHint] = useState('')

  const [exporting, setExporting] = useState(false)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const printRef = useRef<HTMLDivElement>(null)
  const translationPrintRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleDelete() {
    if (!confirm(`"${doc.title}" 문서를 삭제할까요?`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('문서가 삭제되었습니다.')
      router.push('/dashboard')
    } catch {
      toast.error('삭제에 실패했습니다.')
    } finally {
      setDeleting(false)
    }
  }

  // Poll document status while processing
  useEffect(() => {
    if (docStatus !== 'processing') return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/documents/${doc.id}`)
        if (!res.ok) return
        const updated = await res.json()
        if (updated.status !== 'processing') {
          setDocStatus(updated.status)
          if (updated.key_points?.length) setKeyPoints(updated.key_points)
        }
      } catch { /* ignore */ }
    }, 3000)
    return () => clearInterval(interval)
  }, [docStatus, doc.id])

  // Auto-load summary (always 'detailed' on tab open)
  useEffect(() => {
    if (tab === 'summary' && !summary && !summaryLoading && docStatus === 'ready') {
      loadSummary('detailed')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, docStatus])

  // Auto-load key points
  useEffect(() => {
    if (tab === 'keypoints' && keyPoints.length === 0 && !keyPointsLoading && docStatus === 'ready') {
      loadKeyPoints()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, docStatus])

  async function loadSummary(style: SummaryStyle = summaryStyle, withImages = includeImages) {
    setSummaryLoading(true)
    setSummary('')
    try {
      const res = await fetch(`/api/documents/${doc.id}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style, includeImages: withImages }),
      })
      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || '요약 생성에 실패했습니다.')
      }
      if (!res.body) throw new Error('응답 스트림을 읽을 수 없습니다.')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setSummary(prev => prev + decoder.decode(value))
      }
      // After summary loads, refresh recommended questions from DB if not yet available
      if (suggestedQuestions.length === 0) {
        fetch(`/api/documents/${doc.id}`)
          .then(r => r.json())
          .then(d => { if (d.recommended_questions?.length) setSuggestedQuestions(d.recommended_questions) })
          .catch(() => {})
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '요약 생성에 실패했습니다.')
    } finally {
      setSummaryLoading(false)
    }
  }

  async function loadKeyPoints() {
    if (doc.key_points && doc.key_points.length > 0) {
      setKeyPoints(doc.key_points)
      return
    }
    setKeyPointsLoading(true)
    try {
      const res = await fetch(`/api/documents/${doc.id}/summarize`, { method: 'POST' })
      void res
      const docRes = await fetch(`/api/documents/${doc.id}`)
      const latest = await docRes.json()
      if (latest.key_points) setKeyPoints(latest.key_points)
      else toast.info('핵심 포인트가 아직 준비되지 않았습니다. 잠시 후 다시 시도하세요.')
    } catch {
      toast.error('핵심 포인트 로드에 실패했습니다.')
    } finally {
      setKeyPointsLoading(false)
    }
  }

  async function handleAsk(overrideQuestion?: string) {
    const q = (overrideQuestion ?? question).trim()
    if (!q || asking) return

    // Capture history before adding new messages (max 10 Q&A = 20 msgs)
    const historySnapshot = messages
      .filter(m => !m.streaming && m.content)
      .slice(-20)
      .map(({ role, content }) => ({ role, content }))

    setQuestion('')
    setAsking(true)

    setMessages(prev => [...prev, { role: 'user', content: q }])
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }])

    try {
      const res = await fetch(`/api/documents/${doc.id}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, history: historySnapshot }),
      })
      if (!res.ok || !res.body) {
        const text = await res.text()
        throw new Error(text || '답변 생성 실패')
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (last.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content: last.content + chunk }]
          }
          return prev
        })
      }
      setMessages(prev => {
        const last = prev[prev.length - 1]
        return [...prev.slice(0, -1), { ...last, streaming: false }]
      })
    } catch (e: unknown) {
      setMessages(prev => prev.slice(0, -1))
      toast.error(e instanceof Error ? e.message : '답변 생성에 실패했습니다.')
    } finally {
      setAsking(false)
    }
  }

  async function handleTranslate() {
    if (translating) return
    setTranslating(true)
    setTranslation('')
    try {
      const res = await fetch(`/api/documents/${doc.id}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction: translateDir }),
      })
      if (!res.ok || !res.body) {
        const text = await res.text()
        throw new Error(text || '번역에 실패했습니다.')
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setTranslation(prev => prev + decoder.decode(value))
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '번역에 실패했습니다.')
    } finally {
      setTranslating(false)
    }
  }

  async function handleCopyTranslation() {
    if (!translation) return
    await navigator.clipboard.writeText(translation)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleDownloadTranslationFile() {
    if (!isPro) {
      setUpgradeHint('번역 파일 다운로드는 Pro 전용 기능입니다.')
      setUpgradeOpen(true)
      return
    }
    if (!translation) return
    setDownloadingTranslation(true)
    try {
      if (doc.file_type === 'docx') {
        // Call translate-file API to get translated DOCX binary
        const res = await fetch(`/api/documents/${doc.id}/translate-file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ direction: translateDir }),
        })
        if (!res.ok) {
          const text = await res.text()
          throw new Error(text || '번역 파일 생성에 실패했습니다.')
        }
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const safeName = doc.title.replace(/[<>:"/\\|?*]/g, '').trim() || 'document'
        a.download = `${safeName}_translated.docx`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast.success('번역된 DOCX가 다운로드되었습니다.')
      } else {
        // PDF: capture translationPrintRef with html2canvas → jspdf
        if (!translationPrintRef.current) return
        const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
          import('html2canvas-pro'),
          import('jspdf'),
        ])
        const canvas = await html2canvas(translationPrintRef.current, {
          scale: 2,
          backgroundColor: '#ffffff',
          useCORS: true,
          logging: false,
        })
        const imgData = canvas.toDataURL('image/jpeg', 0.92)
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
        const pageW = pdf.internal.pageSize.getWidth()
        const pageH = pdf.internal.pageSize.getHeight()
        const imgH = (canvas.height / canvas.width) * pageW
        let remaining = imgH
        let offset = 0
        while (remaining > 0) {
          if (offset > 0) pdf.addPage()
          pdf.addImage(imgData, 'JPEG', 0, -offset, pageW, imgH)
          offset += pageH
          remaining -= pageH
        }
        const safeName = doc.title.replace(/[<>:"/\\|?*]/g, '').trim() || 'document'
        pdf.save(`${safeName}_translated.pdf`)
        toast.success('번역된 PDF가 다운로드되었습니다.')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '다운로드에 실패했습니다.')
    } finally {
      setDownloadingTranslation(false)
    }
  }

  async function handleExportPdf() {
    if (!isPro) {
      setUpgradeHint('PDF 내보내기는 Pro 전용 기능입니다. 업그레이드하면 요약, 핵심 포인트, 질의응답 기록을 PDF로 저장할 수 있습니다.')
      setUpgradeOpen(true)
      return
    }
    if (!printRef.current) return
    setExporting(true)
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas-pro'),
        import('jspdf'),
      ])

      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      })

      const imgData = canvas.toDataURL('image/jpeg', 0.92)
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const imgH = (canvas.height / canvas.width) * pageW

      let remaining = imgH
      let offset = 0
      while (remaining > 0) {
        if (offset > 0) pdf.addPage()
        pdf.addImage(imgData, 'JPEG', 0, -offset, pageW, imgH)
        offset += pageH
        remaining -= pageH
      }

      const safeName = doc.title.replace(/[<>:"/\\|?*]/g, '').trim() || 'document'
      pdf.save(`${safeName}_분석결과.pdf`)
    } catch {
      toast.error('PDF 생성에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setExporting(false)
    }
  }

  function handleTabClick(id: Tab) {
    if (id === 'translate' && !isPro) {
      setUpgradeHint('번역 기능은 Pro 전용입니다. 업그레이드하면 문서를 한↔영으로 번역할 수 있습니다.')
      setUpgradeOpen(true)
      return
    }
    setTab(id)
  }

  const tabs = [
    { id: 'summary' as Tab, label: '요약', icon: AlignLeft },
    { id: 'keypoints' as Tab, label: '핵심 포인트', icon: Lightbulb },
    { id: 'qa' as Tab, label: '질의응답', icon: MessageSquare },
    { id: 'translate' as Tab, label: '번역', icon: Languages, proOnly: true },
  ]

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-4">
      {/* Upgrade modal (controlled) */}
      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} featureHint={upgradeHint} />

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }))}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            doc.file_type === 'pdf' ? 'bg-red-100 dark:bg-red-900/40'
            : doc.file_type === 'image' ? 'bg-green-100 dark:bg-green-900/40'
            : 'bg-blue-100 dark:bg-blue-900/40'
          }`}>
            {doc.file_type === 'pdf'
              ? <FileText className="h-4 w-4 text-red-600 dark:text-red-400" />
              : doc.file_type === 'image'
              ? <Image className="h-4 w-4 text-green-600 dark:text-green-400" />
              : <FileType className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
          </div>
          <h1 className="font-bold text-lg truncate">{doc.title}</h1>
          {docStatus === 'processing' && (
            <Badge variant="default" className="shrink-0 gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> 분석 중
            </Badge>
          )}
        </div>
        {/* PDF export button */}
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5"
          onClick={handleExportPdf}
          disabled={exporting || docStatus !== 'ready'}
        >
          {exporting ? <LoadingSpinner className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
          PDF 내보내기
          {!isPro && <Zap className="h-3 w-3 text-indigo-500 ml-0.5" />}
        </Button>
      </div>

      {/* Main split layout */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Left: document info */}
        <Card className="w-72 shrink-0 overflow-y-auto flex flex-col">
          <CardHeader className="pb-3">
            {doc.file_type === 'image' ? (
              <div className="w-full mb-3 overflow-hidden rounded-xl border border-border/40 bg-muted/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/documents/${doc.id}/preview`}
                  alt={doc.title}
                  className="w-full object-contain max-h-48"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
            ) : (
              <div className={`flex h-14 w-14 items-center justify-center rounded-xl mx-auto mb-3 ${doc.file_type === 'pdf' ? 'bg-red-100 dark:bg-red-900/40' : 'bg-blue-100 dark:bg-blue-900/40'}`}>
                {doc.file_type === 'pdf'
                  ? <FileText className="h-7 w-7 text-red-600 dark:text-red-400" />
                  : <FileType className="h-7 w-7 text-blue-600 dark:text-blue-400" />}
              </div>
            )}
            <CardTitle className="text-sm font-semibold text-center truncate" title={doc.title}>{doc.title}</CardTitle>
            <p className="text-xs text-muted-foreground text-center uppercase">{doc.file_type}</p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm flex-1">
            {doc.page_count && (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">페이지</span>
                <span className="ml-auto font-medium">{doc.page_count}p</span>
              </div>
            )}
            {doc.file_size && (
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">크기</span>
                <span className="ml-auto font-medium">{formatBytes(doc.file_size)}</span>
              </div>
            )}
            {doc.char_count && (
              <div className="flex items-center gap-2">
                <AlignLeft className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">글자수</span>
                <span className="ml-auto font-medium">{doc.char_count.toLocaleString()}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">업로드</span>
              <span className="ml-auto font-medium text-xs">{formatDate(doc.created_at)}</span>
            </div>

            {doc.file_type === 'pdf' && (
              <>
                <Separator />
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <Info className="h-3 w-3 shrink-0 mt-0.5 text-amber-500" />
                  PDF 내 이미지 분석은 이미지를 별도 업로드해주세요
                </p>
              </>
            )}

            <Separator />

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">분석 현황</p>
              {[
                { label: '요약', done: !!doc.summary },
                { label: '핵심 포인트', done: !!(doc.key_points && doc.key_points.length > 0) },
                { label: '질의응답 준비', done: docStatus === 'ready' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2 text-xs">
                  {item.done
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    : <Circle className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />}
                  <span className={item.done ? 'text-foreground' : 'text-muted-foreground/60'}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>

            <Separator />

            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-2"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              문서 삭제
            </Button>
          </CardContent>
        </Card>

        {/* Right: AI panel */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b px-4">
            {tabs.map(t => {
              const Icon = t.icon
              const isActive = tab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => handleTabClick(t.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors',
                    isActive
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                  {t.proOnly && !isPro && (
                    <Zap className="h-3 w-3 text-indigo-400 ml-0.5" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Summary tab */}
            {tab === 'summary' && (
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Style selector + image toggle */}
                <div className="border-b px-5 py-2.5 flex gap-1.5 flex-wrap items-center shrink-0">
                  {STYLE_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => {
                        setSummaryStyle(value)
                        loadSummary(value)
                      }}
                      disabled={summaryLoading || docStatus !== 'ready'}
                      className={cn(
                        'px-3 py-1 text-xs rounded-full border transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                        summaryStyle === value
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'border-border text-muted-foreground hover:border-indigo-300 hover:text-foreground'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                  {doc.file_type === 'pdf' && (
                    <button
                      onClick={() => {
                        if (!isPro) {
                          setUpgradeHint('이미지 포함 분석은 Pro 전용 기능입니다. PDF 내 이미지, 차트, 그래프까지 AI가 분석합니다.')
                          setUpgradeOpen(true)
                          return
                        }
                        const next = !includeImages
                        setIncludeImages(next)
                        loadSummary(summaryStyle, next)
                      }}
                      disabled={summaryLoading || docStatus !== 'ready'}
                      className={cn(
                        'ml-auto flex items-center gap-1 px-3 py-1 text-xs rounded-full border transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                        includeImages && isPro
                          ? 'bg-green-600 text-white border-green-600'
                          : 'border-border text-muted-foreground hover:border-indigo-300 hover:text-foreground'
                      )}
                    >
                      <Image className="h-3 w-3" />
                      이미지 포함 분석
                      {!isPro && <Zap className="h-3 w-3 text-indigo-400 ml-0.5" />}
                    </button>
                  )}
                </div>
                {/* PDF image hint */}
                {doc.file_type === 'pdf' && (
                  <div className="border-b px-5 py-2 flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/20 shrink-0">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                    <span>
                      이 문서에는 이미지/차트가 포함되어 있을 수 있습니다.
                      {isPro
                        ? ' 이미지 포함 분석을 켜면 더 정확한 결과를 얻을 수 있습니다.'
                        : ' Pro로 업그레이드하면 이미지까지 분석합니다.'}
                    </span>
                  </div>
                )}
                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5">
                  {(summaryLoading && !summary) || (docStatus === 'processing' && !summary) ? (
                    <div className="flex flex-col items-center justify-center h-32 gap-3 text-muted-foreground">
                      <LoadingSpinner className="h-6 w-6 text-indigo-500" />
                      <p className="text-sm">
                        {docStatus === 'processing' ? 'AI가 문서를 분석 중입니다...' : 'AI가 문서를 요약하고 있습니다...'}
                      </p>
                    </div>
                  ) : summary ? (
                    <div className="text-sm">
                      <MarkdownContent>{summary}</MarkdownContent>
                      {summaryLoading && (
                        <span className="inline-block h-4 w-0.5 bg-indigo-500 animate-[pulse_0.7s_ease-in-out_infinite] ml-0.5 align-middle" />
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-32 gap-3">
                      <BrainCircuit className="h-8 w-8 text-muted-foreground/40" />
                      <Button size="sm" onClick={() => loadSummary(summaryStyle)} className="bg-indigo-600 hover:bg-indigo-700">
                        요약 생성하기
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Key points tab */}
            {tab === 'keypoints' && (
              <div className="flex-1 overflow-y-auto p-5">
                {keyPointsLoading ? (
                  <div className="flex flex-col items-center justify-center h-32 gap-3 text-muted-foreground">
                    <LoadingSpinner className="h-6 w-6 text-indigo-500" />
                    <p className="text-sm">핵심 포인트를 추출하고 있습니다...</p>
                  </div>
                ) : keyPoints.length > 0 ? (
                  <ul className="space-y-3">
                    {keyPoints.map((point, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                          {i + 1}
                        </div>
                        <div className="pt-0.5 flex-1 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                          <MarkdownContent>{point}</MarkdownContent>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex flex-col items-center justify-center h-32 gap-3">
                    <Lightbulb className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      {docStatus === 'processing'
                        ? '문서 분석이 완료되면 자동으로 표시됩니다.'
                        : '핵심 포인트가 없습니다.'}
                    </p>
                    {docStatus !== 'processing' && (
                      <Button size="sm" onClick={loadKeyPoints} variant="outline">
                        다시 시도
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Q&A tab */}
            {tab === 'qa' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-4 text-muted-foreground">
                      <MessageSquare className="h-10 w-10 opacity-30" />
                      <div>
                        <p className="font-medium">문서에 대해 질문해보세요</p>
                        <p className="text-sm mt-1">AI가 문서 내용을 바탕으로 답변합니다</p>
                      </div>
                      {docStatus === 'ready' && (
                        <div className="flex flex-col gap-2 w-full max-w-sm">
                          {(suggestedQuestions.length > 0 ? suggestedQuestions : SUGGESTED_QUESTIONS).map(q => (
                            <button
                              key={q}
                              onClick={() => handleAsk(q)}
                              className="text-left text-xs px-3 py-2 rounded-lg border border-border/60 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-colors text-foreground"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {messages.map((msg, i) => (
                    <div key={i}>
                      <div className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                        {msg.role === 'assistant' && (
                          <div className="h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                            <BrainCircuit className="h-3.5 w-3.5 text-white" />
                          </div>
                        )}
                        <div
                          className={cn(
                            'rounded-2xl px-4 py-2.5 text-sm max-w-[80%]',
                            msg.role === 'user'
                              ? 'bg-indigo-600 text-white rounded-tr-sm'
                              : 'bg-muted rounded-tl-sm'
                          )}
                        >
                          {msg.role === 'user' ? (
                            <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                          ) : (
                            <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                              {msg.content && (
                                <MarkdownContent variant="bubble">{msg.content}</MarkdownContent>
                              )}
                              {msg.streaming && msg.content && (
                                <span className="inline-block h-4 w-0.5 bg-current animate-pulse ml-0.5 align-middle opacity-70" />
                              )}
                              {msg.streaming && !msg.content && (
                                <span className="inline-flex gap-1 items-center py-1">
                                  <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
                                  <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
                                  <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      {!msg.streaming && msg.role === 'assistant' && msg.content && (
                        <div className="flex items-center gap-1 mt-1 pl-9">
                          <button
                            className="text-[11px] px-2 py-0.5 rounded border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                            onClick={() => handleAsk('이전 답변을 더 자세히 설명해줘')}
                          >더 자세히</button>
                          <button
                            className="text-[11px] px-2 py-0.5 rounded border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                            onClick={() => handleAsk('이전 답변을 더 쉽게 설명해줘')}
                          >더 쉽게</button>
                          <button
                            className="text-[11px] px-2 py-0.5 rounded border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                            onClick={() => { navigator.clipboard.writeText(msg.content); toast.success('복사됨') }}
                          >복사</button>
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                <div className="border-t p-3">
                  <div className="flex gap-2 items-end">
                    <textarea
                      ref={inputRef}
                      value={question}
                      onChange={e => setQuestion(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleAsk()
                        }
                      }}
                      placeholder="문서에 대해 질문하세요... (Enter로 전송, Shift+Enter 줄바꿈)"
                      rows={2}
                      className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      disabled={asking || docStatus !== 'ready'}
                    />
                    <Button
                      size="icon"
                      className="bg-indigo-600 hover:bg-indigo-700 shrink-0 h-[4.5rem]"
                      onClick={() => handleAsk()}
                      disabled={!question.trim() || asking || docStatus !== 'ready'}
                    >
                      {asking ? <LoadingSpinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                  {docStatus !== 'ready' && (
                    <p className="text-xs text-muted-foreground mt-1 text-center">
                      {docStatus === 'processing' ? 'AI 분석 중... 잠시 기다려주세요.' : '문서 분석이 완료되면 질의응답이 활성화됩니다.'}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Translate tab */}
            {tab === 'translate' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Direction selector + action buttons */}
                <div className="border-b px-3 pt-3 pb-2.5">
                  <div className="flex items-center gap-3">
                    <div className="flex rounded-lg border overflow-hidden">
                      {(['ko-en', 'en-ko'] as TranslateDir[]).map(dir => (
                        <button
                          key={dir}
                          onClick={() => { setTranslateDir(dir); setTranslation('') }}
                          className={cn(
                            'px-4 py-1.5 text-sm font-medium transition-colors',
                            translateDir === dir
                              ? 'bg-indigo-600 text-white'
                              : 'bg-background text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {dir === 'ko-en' ? '한국어 → 영어' : '영어 → 한국어'}
                        </button>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-700 gap-1.5 ml-auto"
                      onClick={handleTranslate}
                      disabled={translating || docStatus !== 'ready'}
                    >
                      {translating
                        ? <><LoadingSpinner className="h-3.5 w-3.5" /> 번역 중...</>
                        : <><Languages className="h-3.5 w-3.5" /> 번역하기</>}
                    </Button>
                    {translation && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={handleCopyTranslation}
                          disabled={translating}
                        >
                          {copied
                            ? <><Check className="h-3.5 w-3.5 text-green-500" /> 복사됨</>
                            : <><Copy className="h-3.5 w-3.5" /> 복사</>}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={handleDownloadTranslationFile}
                          disabled={translating || downloadingTranslation}
                        >
                          {downloadingTranslation
                            ? <LoadingSpinner className="h-3.5 w-3.5" />
                            : <Download className="h-3.5 w-3.5" />}
                          {doc.file_type === 'docx' ? 'DOCX로 다운로드' : 'PDF로 다운로드'}
                        </Button>
                      </>
                    )}
                  </div>
                  {doc.file_type === 'pdf' && translation && (
                    <p className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Info className="h-3 w-3 shrink-0" />
                      PDF 파일은 원본과 레이아웃이 다를 수 있습니다
                    </p>
                  )}
                </div>

                {/* Translation result */}
                <div className="flex-1 overflow-y-auto p-5">
                  {translating && !translation ? (
                    <div className="flex flex-col items-center justify-center h-32 gap-3 text-muted-foreground">
                      <LoadingSpinner className="h-6 w-6 text-indigo-500" />
                      <p className="text-sm">번역 중입니다...</p>
                    </div>
                  ) : translation ? (
                    <div className="text-sm">
                      <MarkdownContent>{translation}</MarkdownContent>
                      {translating && (
                        <span className="inline-block h-4 w-0.5 bg-indigo-500 animate-[pulse_0.7s_ease-in-out_infinite] ml-0.5 align-middle" />
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-muted-foreground">
                      <Languages className="h-10 w-10 opacity-30" />
                      <div>
                        <p className="font-medium">문서 번역</p>
                        <p className="text-sm mt-1">방향을 선택하고 번역하기를 클릭하세요</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Hidden translation print div — captured by html2canvas for translated PDF export */}
      {translation && (
        <div
          ref={translationPrintRef}
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: '-9999px',
            top: 0,
            width: '794px',
            background: '#ffffff',
            color: '#1a1a1a',
            fontFamily: "'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif",
            fontSize: '12px',
            lineHeight: 1.7,
            padding: '60px',
          }}
        >
          <div style={{ borderBottom: '2px solid #4f46e5', paddingBottom: '16px', marginBottom: '32px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#4f46e5', marginBottom: '8px' }}>DocuMind</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#111', marginBottom: '4px' }}>{doc.title}</div>
            <div style={{ fontSize: '10px', color: '#888' }}>
              {translateDir === 'ko-en' ? '한국어 → 영어 번역' : '영어 → 한국어 번역'}
              &nbsp;·&nbsp;내보내기: {new Date().toLocaleDateString('ko-KR')}
            </div>
          </div>
          <div style={{ fontSize: '11px', lineHeight: 1.8 }}>
            <MarkdownContent>{translation}</MarkdownContent>
          </div>
          <div style={{ marginTop: '40px', paddingTop: '12px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#aaa' }}>
            <span>DocuMind — AI 기반 문서 분석</span>
            <span>{new Date().toLocaleDateString('ko-KR')}</span>
          </div>
        </div>
      )}

      {/* Hidden print div — captured by html2canvas for PDF export */}
      <div
        ref={printRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          width: '794px',
          background: '#ffffff',
          color: '#1a1a1a',
          fontFamily: "'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif",
          fontSize: '12px',
          lineHeight: 1.7,
          padding: '60px',
        }}
      >
        {/* Header */}
        <div style={{ borderBottom: '2px solid #4f46e5', paddingBottom: '16px', marginBottom: '32px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#4f46e5', marginBottom: '8px' }}>DocuMind</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#111', marginBottom: '4px' }}>{doc.title}</div>
          <div style={{ fontSize: '10px', color: '#888' }}>업로드: {formatDate(doc.created_at)} &nbsp;·&nbsp; 내보내기: {new Date().toLocaleDateString('ko-KR')}</div>
        </div>

        {/* Summary */}
        {summary && (
          <PrintSection title="문서 요약">
            <div style={{ whiteSpace: 'pre-wrap', fontSize: '11px', lineHeight: 1.8 }}>
              {summary.replace(/#{1,6}\s+/g, '').replace(/\*\*/g, '')}
            </div>
          </PrintSection>
        )}

        {/* Key points */}
        {keyPoints.length > 0 && (
          <PrintSection title="핵심 포인트">
            <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {keyPoints.map((point, i) => (
                <li key={i} style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'flex-start' }}>
                  <span style={{
                    flexShrink: 0, width: '20px', height: '20px', borderRadius: '50%',
                    background: '#ede9fe', color: '#4f46e5', fontSize: '10px', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{i + 1}</span>
                  <span style={{ flex: 1, paddingTop: '1px' }}>{point}</span>
                </li>
              ))}
            </ol>
          </PrintSection>
        )}

        {/* Q&A */}
        {messages.some(m => m.role === 'user') && (
          <PrintSection title="질의응답 히스토리">
            {messages.reduce<{ q: string; a: string }[]>((pairs, msg, i) => {
              if (msg.role === 'user') pairs.push({ q: msg.content, a: messages[i + 1]?.content ?? '' })
              return pairs
            }, []).map((pair, i) => (
              <div key={i} style={{ marginBottom: '16px' }}>
                <div style={{ fontWeight: 700, color: '#4f46e5', marginBottom: '4px', fontSize: '11px' }}>Q. {pair.q}</div>
                <div style={{ paddingLeft: '12px', borderLeft: '2px solid #e5e7eb', fontSize: '11px', lineHeight: 1.7 }}>
                  {pair.a.replace(/#{1,6}\s+/g, '').replace(/\*\*/g, '')}
                </div>
              </div>
            ))}
          </PrintSection>
        )}

        {/* Footer */}
        <div style={{ marginTop: '40px', paddingTop: '12px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#aaa' }}>
          <span>DocuMind — AI 기반 문서 분석</span>
          <span>{new Date().toLocaleDateString('ko-KR')}</span>
        </div>
      </div>
    </div>
  )
}

function PrintSection({ title, children }: { title: string; children: React.ReactNode }) {
  const s: CSSProperties = {
    marginBottom: '28px',
  }
  const h: CSSProperties = {
    fontSize: '13px',
    fontWeight: 700,
    color: '#4f46e5',
    borderBottom: '1px solid #e5e7eb',
    paddingBottom: '6px',
    marginBottom: '12px',
  }
  return (
    <div style={s}>
      <div style={h}>{title}</div>
      {children}
    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Presentation, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Download, Plus, Clock, FileText, Pencil, Check, X,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type PStyle = 'business' | 'academic' | 'casual'
type PLang = 'ko' | 'en'

interface Slide {
  slideNumber: number
  title: string
  content: string[]
  notes: string
}

interface PresentationData {
  title: string
  slides: Slide[]
}

interface PresRecord {
  id: string
  title: string
  settings: { slides: number; style: PStyle; language: PLang }
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STYLE_META: Record<PStyle, { label: string; desc: string }> = {
  business: { label: '비즈니스', desc: '데이터와 결론 중심' },
  academic: { label: '학술', desc: '논문/연구 발표용' },
  casual: { label: '캐주얼', desc: '가벼운 발표용' },
}

const LANG_LABELS: Record<PLang, string> = { ko: '한국어', en: 'English' }

// pptxgenjs style themes
const PPTX_THEMES: Record<PStyle, {
  bg: string; titleColor: string; bodyColor: string;
  accentBg: string; accentColor: string; footerColor: string
}> = {
  business: {
    bg: '1B2A5E',          titleColor: 'FFFFFF', bodyColor: 'E8EAF6',
    accentBg: '3949AB',    accentColor: 'FFFFFF', footerColor: '9FA8DA',
  },
  academic: {
    bg: 'FFFFFF',          titleColor: '1A237E', bodyColor: '37474F',
    accentBg: 'E8EAF6',    accentColor: '1A237E', footerColor: '90A4AE',
  },
  casual: {
    bg: 'FFF9C4',          titleColor: '4A148C', bodyColor: '4A148C',
    accentBg: 'CE93D8',    accentColor: 'FFFFFF', footerColor: '7B1FA2',
  },
}

// Slide card preview background colours
const CARD_BG: Record<PStyle, string> = {
  business: 'bg-[#1B2A5E] text-white',
  academic: 'bg-white text-gray-900 border',
  casual: 'bg-yellow-50 text-purple-900 border border-yellow-200',
}

const CARD_ACCENT: Record<PStyle, string> = {
  business: 'bg-[#3949AB] text-white',
  academic: 'bg-indigo-50 text-indigo-900',
  casual: 'bg-purple-200 text-purple-900',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// ─── Inline editable field ────────────────────────────────────────────────────

function EditableText({
  value, onChange, multiline, className,
}: { value: string; onChange: (v: string) => void; multiline?: boolean; className?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement>(null)

  useEffect(() => { if (editing) ref.current?.focus() }, [editing])

  function commit() { onChange(draft); setEditing(false) }
  function cancel() { setDraft(value); setEditing(false) }

  if (editing) {
    return (
      <span className="flex items-start gap-1 w-full">
        {multiline ? (
          <textarea
            ref={ref as React.RefObject<HTMLTextAreaElement>}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') cancel() }}
            rows={3}
            className={cn('flex-1 resize-none rounded px-2 py-1 text-sm bg-black/10 dark:bg-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-400', className)}
          />
        ) : (
          <input
            ref={ref as React.RefObject<HTMLInputElement>}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
            className={cn('flex-1 rounded px-2 py-0.5 text-sm bg-black/10 dark:bg-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-400', className)}
          />
        )}
        <button onClick={commit} className="shrink-0 p-0.5 hover:text-green-400 transition-colors"><Check className="h-3.5 w-3.5" /></button>
        <button onClick={cancel} className="shrink-0 p-0.5 hover:text-red-400 transition-colors"><X className="h-3.5 w-3.5" /></button>
      </span>
    )
  }

  return (
    <span
      className={cn('group flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity w-full', className)}
      onClick={() => { setDraft(value); setEditing(true) }}
    >
      <span className="flex-1">{value}</span>
      <Pencil className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-50 transition-opacity" />
    </span>
  )
}

// ─── Slide card (preview) ─────────────────────────────────────────────────────

function SlideCard({
  slide, style, index, total, onUpdate,
}: {
  slide: Slide
  style: PStyle
  index: number
  total: number
  onUpdate: (slide: Slide) => void
}) {
  const [notesOpen, setNotesOpen] = useState(false)

  function updateTitle(title: string) { onUpdate({ ...slide, title }) }
  function updateContent(i: number, val: string) {
    const content = [...slide.content]
    content[i] = val
    onUpdate({ ...slide, content })
  }
  function updateNotes(notes: string) { onUpdate({ ...slide, notes }) }

  return (
    <div className={cn('rounded-xl overflow-hidden shadow-sm flex flex-col min-h-[260px]', CARD_BG[style])}>
      {/* Header */}
      <div className={cn('px-5 py-3 flex items-center gap-2', CARD_ACCENT[style])}>
        <span className="text-xs font-bold opacity-70">{index + 1} / {total}</span>
        <span className="flex-1 text-sm font-bold truncate">
          <EditableText value={slide.title} onChange={updateTitle} />
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 py-4 space-y-2">
        {slide.content.map((point, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <span className="mt-1 h-1.5 w-1.5 rounded-full shrink-0 bg-current opacity-60" />
            <EditableText value={point} onChange={v => updateContent(i, v)} className="flex-1" />
          </div>
        ))}
      </div>

      {/* Notes toggle */}
      <div className="border-t border-white/10">
        <button
          onClick={() => setNotesOpen(v => !v)}
          className="w-full flex items-center gap-1.5 px-5 py-2 text-xs opacity-60 hover:opacity-100 transition-opacity"
        >
          {notesOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          발표자 노트
        </button>
        {notesOpen && (
          <div className="px-5 pb-4 text-xs opacity-80 leading-relaxed">
            <EditableText value={slide.notes} onChange={updateNotes} multiline />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── PPTX export ─────────────────────────────────────────────────────────────

async function downloadPptx(
  data: PresentationData,
  style: PStyle,
  docTitle: string,
) {
  const pptxgenjs = (await import('pptxgenjs')).default
  const pptx = new pptxgenjs()
  const theme = PPTX_THEMES[style]

  pptx.layout = 'LAYOUT_WIDE'
  pptx.title = data.title

  for (const slide of data.slides) {
    const s = pptx.addSlide()

    // Background
    s.background = { color: theme.bg }

    const isTitle = slide.slideNumber === 1

    if (isTitle) {
      // Title slide layout
      s.addText(slide.title, {
        x: 0.5, y: 1.8, w: '90%', h: 1.2,
        fontSize: 36, bold: true, color: theme.titleColor,
        align: 'center',
      })
      if (slide.content[0]) {
        s.addText(slide.content[0], {
          x: 0.5, y: 3.2, w: '90%', h: 0.8,
          fontSize: 18, color: theme.bodyColor,
          align: 'center',
        })
      }
    } else {
      // Title bar
      s.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: 1.1,
        fill: { color: theme.accentBg },
        line: { color: theme.accentBg },
      })
      s.addText(slide.title, {
        x: 0.5, y: 0.15, w: '90%', h: 0.8,
        fontSize: 22, bold: true, color: theme.accentColor,
      })

      // Bullet points
      const bullets = slide.content.map(c => ({ text: c, options: { bullet: true } }))
      s.addText(bullets, {
        x: 0.5, y: 1.3, w: '90%', h: 3.8,
        fontSize: 16, color: theme.bodyColor,
        paraSpaceAfter: 8,
        valign: 'top',
      })
    }

    // Slide number footer
    s.addText(`${slide.slideNumber} / ${data.slides.length}`, {
      x: 0, y: 6.9, w: '100%', h: 0.3,
      fontSize: 10, color: theme.footerColor,
      align: 'right',
    })

    // Speaker notes
    if (slide.notes) {
      s.addNotes(slide.notes)
    }
  }

  const safeName = docTitle.replace(/[<>:"/\\|?*]/g, '').trim() || 'document'
  await pptx.writeFile({ fileName: `${safeName}_프레젠테이션.pptx` })
}

// ─── History item ─────────────────────────────────────────────────────────────

function HistoryItem({
  item, onLoad,
}: { item: PresRecord; onLoad: (id: string) => void }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card text-sm">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/40">
        <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{item.title}</p>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
          <Clock className="h-3 w-3" />
          {formatDate(item.created_at)}
          <span className="px-1.5 py-0.5 rounded bg-muted font-medium">{STYLE_META[item.settings.style].label}</span>
          <span>{item.settings.slides}장</span>
          <span>{LANG_LABELS[item.settings.language]}</span>
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={() => onLoad(item.id)}>
        불러오기
      </Button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  documentId: string
  documentTitle: string
  disabled: boolean
}

type View = 'settings' | 'preview'

export function PresentationTab({ documentId, documentTitle, disabled }: Props) {
  // Settings
  const [slideCount, setSlideCount] = useState(10)
  const [presStyle, setPresStyle] = useState<PStyle>('business')
  const [language, setLanguage] = useState<PLang>('ko')
  const [generating, setGenerating] = useState(false)

  // Presentation data
  const [view, setView] = useState<View>('settings')
  const [presentation, setPresentation] = useState<PresentationData | null>(null)
  const [currentSettings, setCurrentSettings] = useState<{ style: PStyle } | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [downloading, setDownloading] = useState(false)

  // History
  const [history, setHistory] = useState<PresRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  useEffect(() => {
    if (disabled) return
    fetch(`/api/documents/${documentId}/presentation`)
      .then(r => r.json())
      .then(d => setHistory(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setHistoryLoading(false))
  }, [documentId, disabled])

  // ── Generate ──────────────────────────────────────────────────────────────

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await fetch(`/api/documents/${documentId}/presentation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slides: slideCount, style: presStyle, language }),
      })
      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || '프레젠테이션 생성에 실패했습니다.')
      }
      const saved = await res.json()
      setHistory(prev => [
        { id: saved.id, title: saved.title, settings: saved.settings, created_at: saved.created_at },
        ...prev,
      ])
      setPresentation(saved.data as PresentationData)
      setCurrentSettings({ style: presStyle })
      setActiveIdx(0)
      setView('preview')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '프레젠테이션 생성에 실패했습니다.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleLoadHistory(presId: string) {
    setLoadingId(presId)
    try {
      const res = await fetch(`/api/documents/${documentId}/presentation/${presId}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setPresentation(data.data as PresentationData)
      setCurrentSettings({ style: data.settings.style })
      setActiveIdx(0)
      setView('preview')
    } catch {
      toast.error('불러오기에 실패했습니다.')
    } finally {
      setLoadingId(null)
    }
  }

  function updateSlide(idx: number, updated: Slide) {
    if (!presentation) return
    const slides = [...presentation.slides]
    slides[idx] = updated
    setPresentation({ ...presentation, slides })
  }

  async function handleDownload() {
    if (!presentation || !currentSettings) return
    setDownloading(true)
    try {
      await downloadPptx(presentation, currentSettings.style, documentTitle)
      toast.success('PPTX 파일이 다운로드되었습니다.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PPTX 생성에 실패했습니다.')
    } finally {
      setDownloading(false)
    }
  }

  // ─── Render: Settings ─────────────────────────────────────────────────────

  if (view === 'settings') {
    return (
      <div className="flex-1 overflow-y-auto p-5">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/40 shrink-0">
            <Presentation className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <p className="font-semibold text-sm">프레젠테이션 생성</p>
            <p className="text-xs text-muted-foreground">문서 내용으로 AI가 슬라이드를 자동 구성합니다</p>
          </div>
        </div>

        <div className="space-y-5 max-w-lg">
          {/* Slide count */}
          <div>
            <p className="text-sm font-medium mb-2">슬라이드 수</p>
            <div className="flex gap-2">
              {([5, 10, 15] as const).map(n => (
                <button
                  key={n}
                  onClick={() => setSlideCount(n)}
                  className={cn(
                    'px-4 py-1.5 text-sm rounded-lg border font-medium transition-colors',
                    slideCount === n
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-border text-muted-foreground hover:border-indigo-300 hover:text-foreground'
                  )}
                >
                  {n}장
                </button>
              ))}
            </div>
          </div>

          {/* Style */}
          <div>
            <p className="text-sm font-medium mb-2">스타일</p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(STYLE_META) as [PStyle, { label: string; desc: string }][]).map(([key, meta]) => (
                <button
                  key={key}
                  onClick={() => setPresStyle(key)}
                  className={cn(
                    'px-3 py-2.5 text-sm rounded-lg border font-medium transition-colors text-left',
                    presStyle === key
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-border text-muted-foreground hover:border-indigo-300 hover:text-foreground'
                  )}
                >
                  <span className="block font-semibold">{meta.label}</span>
                  <span className="block text-xs mt-0.5 opacity-75">{meta.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div>
            <p className="text-sm font-medium mb-2">언어</p>
            <div className="flex gap-2">
              {(['ko', 'en'] as PLang[]).map(l => (
                <button
                  key={l}
                  onClick={() => setLanguage(l)}
                  className={cn(
                    'px-4 py-1.5 text-sm rounded-lg border font-medium transition-colors',
                    language === l
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-border text-muted-foreground hover:border-indigo-300 hover:text-foreground'
                  )}
                >
                  {LANG_LABELS[l]}
                </button>
              ))}
            </div>
          </div>

          <Button
            className="bg-indigo-600 hover:bg-indigo-700 gap-2 w-full sm:w-auto"
            onClick={handleGenerate}
            disabled={generating || disabled}
          >
            {generating
              ? <><LoadingSpinner className="h-4 w-4" /> AI가 슬라이드를 생성하고 있습니다...</>
              : <><Presentation className="h-4 w-4" /> 프레젠테이션 생성</>}
          </Button>
        </div>

        {/* History */}
        {!historyLoading && history.length > 0 && (
          <div className="mt-8 max-w-lg">
            <button
              onClick={() => setShowHistory(v => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground mb-3 transition-colors"
            >
              {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              이전 프레젠테이션 ({history.length}개)
            </button>
            {showHistory && (
              <div className="space-y-2">
                {history.map(item => (
                  <div key={item.id} className="relative">
                    {loadingId === item.id && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-lg z-10">
                        <LoadingSpinner className="h-5 w-5 text-indigo-500" />
                      </div>
                    )}
                    <HistoryItem item={item} onLoad={handleLoadHistory} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ─── Render: Preview ──────────────────────────────────────────────────────

  if (view === 'preview' && presentation && currentSettings) {
    const slides = presentation.slides
    const total = slides.length
    const style = currentSettings.style

    return (
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="border-b px-5 py-2.5 flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={() => setView('settings')}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            설정으로
          </button>
          <span className="text-muted-foreground/40 hidden sm:block">|</span>
          <p className="font-semibold text-sm flex-1 truncate hidden sm:block">{presentation.title}</p>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 ml-auto"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading
              ? <><LoadingSpinner className="h-3.5 w-3.5" /> 생성 중...</>
              : <><Download className="h-3.5 w-3.5" /> PPTX 다운로드</>}
          </Button>
          <Button
            size="sm"
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700"
            onClick={() => setView('settings')}
          >
            <Plus className="h-3.5 w-3.5" /> 새로 만들기
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Large carousel */}
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveIdx(i => Math.max(0, i - 1))}
                disabled={activeIdx === 0}
                className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg border disabled:opacity-30 hover:bg-muted transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex-1">
                <SlideCard
                  slide={slides[activeIdx]}
                  style={style}
                  index={activeIdx}
                  total={total}
                  onUpdate={updated => updateSlide(activeIdx, updated)}
                />
              </div>

              <button
                onClick={() => setActiveIdx(i => Math.min(total - 1, i + 1))}
                disabled={activeIdx === total - 1}
                className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg border disabled:opacity-30 hover:bg-muted transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Dot indicators */}
            <div className="flex justify-center gap-1.5 mt-3">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIdx(i)}
                  className={cn(
                    'rounded-full transition-all',
                    i === activeIdx ? 'w-4 h-2 bg-indigo-600' : 'w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/60'
                  )}
                />
              ))}
            </div>
          </div>

          {/* Full slide list */}
          <div className="px-5 pb-5">
            <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
              전체 슬라이드 목록 — 클릭하여 편집
            </p>
            <div className="space-y-3">
              {slides.map((slide, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-xl overflow-hidden ring-2 transition-all cursor-pointer',
                    i === activeIdx ? 'ring-indigo-500' : 'ring-transparent hover:ring-indigo-200'
                  )}
                  onClick={() => setActiveIdx(i)}
                >
                  <SlideCard
                    slide={slide}
                    style={style}
                    index={i}
                    total={total}
                    onUpdate={updated => updateSlide(i, updated)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}

import Link from 'next/link'
import { buttonVariants } from '@/lib/button-variants'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, Sparkles, FileText, MessageSquare, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-background">
      {/* Gradient background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-background to-violet-50 dark:from-indigo-950/30 dark:via-background dark:to-violet-950/20" />
        {/* Dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.12] dark:opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-indigo-400/10 blur-3xl" />
      </div>

      <div className="container mx-auto max-w-6xl px-4 py-24 sm:py-32 text-center">
        <Badge variant="secondary" className="mb-6 gap-1.5 px-4 py-1.5 text-sm">
          <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
          AI 기반 문서 분석
        </Badge>

        <h1 className="mx-auto max-w-4xl text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
          AI로 문서를{' '}
          <span className="bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent">
            즉시 분석하세요
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
          PDF, DOCX 문서를 업로드하면 AI가 자동으로 요약, 핵심 포인트 추출, 질의응답을 제공합니다.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/signup"
            className={cn(buttonVariants({ size: 'lg' }), 'h-12 px-8 text-base bg-indigo-600 hover:bg-indigo-700 gap-2')}
          >
            무료로 시작하기
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="#features"
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-12 px-8 text-base')}
          >
            기능 보기
          </Link>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          신용카드 불필요 · 무료 플랜 제공 · 언제든 해지 가능
        </p>

        {/* Document analysis demo UI */}
        <div className="mt-16 rounded-2xl border bg-card/60 shadow-2xl backdrop-blur-sm overflow-hidden">
          {/* Window chrome */}
          <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/40">
            <div className="h-3 w-3 rounded-full bg-red-400" />
            <div className="h-3 w-3 rounded-full bg-yellow-400" />
            <div className="h-3 w-3 rounded-full bg-green-400" />
            <div className="ml-3 text-xs text-muted-foreground font-mono">DocuMind — 문서 분석</div>
          </div>

          <div className="grid md:grid-cols-2 text-left">
            {/* Left: document info */}
            <div className="p-6 border-r">
              <div className="flex items-start gap-3 mb-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900">
                  <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="font-semibold text-sm">연간_보고서_2024.pdf</p>
                  <p className="text-xs text-muted-foreground mt-0.5">42페이지 · 업로드 완료</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-2 w-4/5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
                </div>
                <p className="text-xs text-muted-foreground">분석 중... 80%</p>
              </div>
              <div className="mt-4 space-y-2">
                {['문서 요약 생성', '핵심 포인트 추출', '청크 분할 완료'].map((step, i) => (
                  <div key={step} className="flex items-center gap-2 text-xs">
                    <div className={cn('h-4 w-4 rounded-full flex items-center justify-center', i < 2 ? 'bg-green-100 dark:bg-green-900' : 'bg-indigo-100 dark:bg-indigo-900')}>
                      {i < 2
                        ? <span className="text-green-600 dark:text-green-400 text-[10px]">✓</span>
                        : <Zap className="h-2.5 w-2.5 text-indigo-500 animate-pulse" />}
                    </div>
                    <span className={i < 2 ? 'text-foreground' : 'text-muted-foreground'}>{step}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: AI chat */}
            <div className="p-6 flex flex-col gap-3">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="h-4 w-4 text-indigo-500" />
                <span className="text-xs font-medium text-muted-foreground">질의응답</span>
              </div>
              {/* AI bubble */}
              <div className="flex gap-2">
                <div className="h-6 w-6 shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                  <span className="text-white text-[10px] font-bold">AI</span>
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-xs max-w-xs">
                  이 문서의 주요 내용은 2024년 매출이 전년 대비 23% 성장했으며...
                </div>
              </div>
              {/* User bubble */}
              <div className="flex gap-2 justify-end">
                <div className="rounded-2xl rounded-tr-sm bg-indigo-600 text-white px-3 py-2 text-xs max-w-xs">
                  3분기 실적이 가장 좋은 이유가 뭔가요?
                </div>
              </div>
              {/* AI typing */}
              <div className="flex gap-2">
                <div className="h-6 w-6 shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                  <span className="text-white text-[10px] font-bold">AI</span>
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-xs">
                  <span className="inline-flex gap-1 items-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

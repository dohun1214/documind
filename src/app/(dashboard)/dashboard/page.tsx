import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { buttonVariants } from '@/lib/button-variants'
import { DocumentCard } from '@/components/dashboard/DocumentCard'
import { FileText, Upload, Files, BarChart2, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Document } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: documents } = await supabase
    .from('documents')
    .select('id, title, file_type, file_size, page_count, status, summary, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const docs = (documents ?? []) as Document[]

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const thisMonthCount = docs.filter(d => d.created_at >= startOfMonth).length
  const todayCount = docs.filter(d => d.created_at >= startOfToday).length
  const remainingFree = Math.max(0, 3 - todayCount)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">내 문서</h1>
          <p className="text-muted-foreground">업로드한 문서를 분석하고 질문하세요.</p>
        </div>
        <Link
          href="/dashboard/upload"
          className={cn(buttonVariants(), 'bg-indigo-600 hover:bg-indigo-700 gap-2')}
        >
          <Upload className="h-4 w-4" />
          문서 업로드
        </Link>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/40">
            <Files className="h-4.5 w-4.5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <p className="text-2xl font-bold leading-none">{docs.length}</p>
            <p className="text-xs text-muted-foreground mt-1">총 문서</p>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/40">
            <BarChart2 className="h-4.5 w-4.5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="text-2xl font-bold leading-none">{thisMonthCount}</p>
            <p className="text-xs text-muted-foreground mt-1">이번 달 분석</p>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
          <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', remainingFree === 0 ? 'bg-red-100 dark:bg-red-900/40' : 'bg-green-100 dark:bg-green-900/40')}>
            <Zap className={cn('h-4.5 w-4.5', remainingFree === 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400')} />
          </div>
          <div>
            <p className={cn('text-2xl font-bold leading-none', remainingFree === 0 ? 'text-red-500' : 'text-green-500')}>{remainingFree}</p>
            <p className="text-xs text-muted-foreground mt-1">오늘 남은 무료</p>
          </div>
        </div>
      </div>

      {docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-900 mb-4">
            <FileText className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold mb-2">아직 문서가 없습니다</h3>
          <p className="text-muted-foreground text-sm mb-6">
            PDF 또는 DOCX 파일을 업로드하면 AI가 즉시 분석해드립니다.
          </p>
          <Link
            href="/dashboard/upload"
            className={cn(buttonVariants(), 'bg-indigo-600 hover:bg-indigo-700 gap-2')}
          >
            <Upload className="h-4 w-4" />
            첫 문서 업로드하기
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((doc) => (
            <DocumentCard key={doc.id} document={doc} />
          ))}
        </div>
      )}
    </div>
  )
}

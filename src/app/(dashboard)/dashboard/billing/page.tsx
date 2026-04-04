'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { UpgradeModal } from '@/components/dashboard/UpgradeModal'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import {
  CreditCard, Zap, ExternalLink, CheckCircle2,
  Calendar, AlertCircle, Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

type SubData = {
  plan: 'free' | 'pro'
  status: string | null
  current_period_start: string | null
  current_period_end: string | null
  created_at: string
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function BillingPage() {
  const router = useRouter()
  const [sub, setSub] = useState<SubData | null>(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      supabase
        .from('subscriptions')
        .select('plan, status, current_period_start, current_period_end, created_at')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          setSub(data as SubData | null)
          setLoading(false)
        })
    })
  }, [router])

  const isPro = sub?.plan === 'pro' && sub?.status === 'active'

  async function handlePortal() {
    setPortalLoading(true)
    setPortalError(false)
    try {
      const res = await fetch('/api/lemon-squeezy/portal')
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.open(url, '_blank')
    } catch {
      setPortalError(true)
      toast.error('구독 관리 페이지를 불러오는 데 실패했습니다.')
    } finally {
      setPortalLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-24" />
        <Card>
          <CardHeader className="space-y-1.5">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-40" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-14 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">구독 관리</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            현재 플랜
          </CardTitle>
          <CardDescription>구독 정보 및 결제 관리</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Plan badge + status */}
          <div className="flex items-center gap-3">
            <Badge
              variant={isPro ? 'default' : 'secondary'}
              className={isPro ? 'bg-indigo-600 text-white' : ''}
            >
              {isPro ? 'Pro' : '무료'}
            </Badge>
            {sub?.status && (
              <span className="text-sm text-muted-foreground">
                {sub.status === 'active' ? '활성'
                  : sub.status === 'cancelled' ? '해지됨'
                  : sub.status === 'past_due' ? '결제 미납'
                  : sub.status === 'paused' ? '일시정지'
                  : sub.status}
              </span>
            )}
          </div>

          {/* Subscription dates */}
          {isPro && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2.5">
              {sub?.current_period_start && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">구독 시작</span>
                  <span className="ml-auto font-medium">{fmtDate(sub.current_period_start)}</span>
                </div>
              )}
              {sub?.current_period_end && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">다음 결제일</span>
                  <span className="ml-auto font-medium">{fmtDate(sub.current_period_end)}</span>
                </div>
              )}
            </div>
          )}

          <Separator />

          {isPro ? (
            <div className="space-y-4">
              {/* Pro features */}
              <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 p-4 space-y-2">
                <p className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  Pro 플랜 이용 중
                </p>
                {[
                  '무제한 문서 분석',
                  '문서 번역 (한↔영)',
                  'PDF 내보내기',
                  '무제한 질의응답',
                ].map(f => (
                  <p key={f} className="text-xs text-muted-foreground ml-5">· {f}</p>
                ))}
              </div>

              {/* Portal error message */}
              {portalError && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-4 py-3">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    구독 관리 페이지를 준비 중입니다. 잠시 후 다시 시도해주세요.
                  </p>
                </div>
              )}

              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handlePortal}
                disabled={portalLoading}
              >
                {portalLoading
                  ? <><LoadingSpinner className="h-4 w-4" /> 처리 중...</>
                  : <><ExternalLink className="h-4 w-4" /> Lemon Squeezy에서 구독 관리</>}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                결제 정보 변경 · 구독 해지는 Lemon Squeezy 포털에서 가능합니다
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-800 p-4">
                <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1 flex items-center gap-1.5">
                  <Zap className="h-4 w-4" />
                  Pro로 업그레이드
                </p>
                <p className="text-sm text-muted-foreground">
                  무제한 문서 분석, 번역, PDF 내보내기 기능을 이용하세요.
                </p>
              </div>
              <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen}>
                <Button
                  className="w-full bg-indigo-600 hover:bg-indigo-700 gap-2"
                  onClick={() => setUpgradeOpen(true)}
                >
                  <Zap className="h-4 w-4" />
                  Pro로 업그레이드 — $9.99/월
                </Button>
              </UpgradeModal>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

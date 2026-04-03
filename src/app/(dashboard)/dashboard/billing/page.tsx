'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { UpgradeModal } from '@/components/dashboard/UpgradeModal'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { CreditCard, Zap, ExternalLink, CheckCircle2, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

type SubData = {
  plan: 'free' | 'pro'
  status: string | null
  current_period_end: string | null
}

export default function BillingPage() {
  const router = useRouter()
  const [sub, setSub] = useState<SubData | null>(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      supabase
        .from('subscriptions')
        .select('plan, status, current_period_end')
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
    try {
      const res = await fetch('/api/lemon-squeezy/portal')
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.open(url, '_blank')
    } catch {
      toast.error('포털 URL을 불러오는 데 실패했습니다.')
    } finally {
      setPortalLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <LoadingSpinner className="h-6 w-6 text-indigo-500" />
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
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge
              variant={isPro ? 'default' : 'secondary'}
              className={isPro ? 'bg-indigo-600 text-white' : ''}
            >
              {isPro ? 'Pro' : '무료'}
            </Badge>
            {sub?.status && (
              <span className="text-sm text-muted-foreground capitalize">
                {sub.status === 'active' ? '활성' : sub.status}
              </span>
            )}
          </div>

          {isPro && sub?.current_period_end && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0" />
              다음 갱신일: {new Date(sub.current_period_end).toLocaleDateString('ko-KR')}
            </div>
          )}

          {isPro ? (
            <div className="space-y-3">
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
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handlePortal}
                disabled={portalLoading}
              >
                {portalLoading
                  ? <LoadingSpinner className="h-4 w-4" />
                  : <ExternalLink className="h-4 w-4" />}
                구독 관리 (결제 정보 · 해지)
              </Button>
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

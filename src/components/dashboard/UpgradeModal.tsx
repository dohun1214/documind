'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { PLANS } from '@/lib/lemon-squeezy/config'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Check, Zap } from 'lucide-react'
import { toast } from 'sonner'

interface UpgradeModalProps {
  children?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Shown at the top of the modal to explain why it opened */
  featureHint?: string
}

const PRO_FEATURES = [
  '무제한 문서 분석',
  '200페이지까지 지원',
  '무제한 질의응답',
  '문서 번역 (한↔영)',
  'PDF 내보내기',
  '무제한 히스토리',
]

export function UpgradeModal({ children, open, onOpenChange, featureHint }: UpgradeModalProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleUpgrade() {
    setLoading(true)
    try {
      const res = await fetch('/api/lemon-squeezy/checkout', { method: 'POST' })
      if (res.status === 401) {
        router.push('/signup')
        return
      }
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch {
      toast.error('Failed to start checkout. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children && <DialogTrigger render={children} />}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900">
              <Zap className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <DialogTitle className="text-xl">Pro로 업그레이드</DialogTitle>
          <DialogDescription>
            {featureHint
              ? featureHint
              : '월 $9.99로 모든 Pro 기능을 무제한으로 이용하세요.'}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-3">
          {PRO_FEATURES.map((feature) => (
            <div key={feature} className="flex items-center gap-3 text-sm">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900 shrink-0">
                <Check className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
              </div>
              {feature}
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-3">
          <Button
            className="w-full bg-indigo-600 hover:bg-indigo-700"
            onClick={handleUpgrade}
            disabled={loading}
          >
            {loading ? (
              <LoadingSpinner className="mr-2 h-4 w-4" />
            ) : (
              <Zap className="mr-2 h-4 w-4" />
            )}
            Pro 시작하기 — $9.99/월
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            언제든 해지 가능 · Lemon Squeezy 보안 결제
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/lib/button-variants'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Check, X } from 'lucide-react'
import { toast } from 'sonner'

const freePlan = {
  name: 'Free',
  price: 0,
  description: '개인 사용자에게 적합',
  features: [
    { label: '하루 3문서 분석', included: true },
    { label: '10페이지 이하 문서', included: true },
    { label: '문서당 질문 5회', included: true },
    { label: '최근 5개 히스토리', included: true },
    { label: '문서 번역', included: false },
    { label: 'PDF 내보내기', included: false },
  ],
}

const proPlan = {
  name: 'Pro',
  price: 9.99,
  description: '업무에 적극 활용하는 분께',
  features: [
    { label: '무제한 문서 분석', included: true },
    { label: '200페이지까지 지원', included: true },
    { label: '무제한 질문', included: true },
    { label: '무제한 히스토리', included: true },
    { label: '문서 번역 (한↔영)', included: true },
    { label: 'PDF 내보내기', included: true },
  ],
}

export function Pricing() {
  const router = useRouter()
  const [loadingPro, setLoadingPro] = useState(false)

  async function handleProCheckout() {
    setLoadingPro(true)
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
      toast.error('결제 시작에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setLoadingPro(false)
    }
  }

  return (
    <section id="pricing" className="py-24 bg-background">
      <div className="container mx-auto max-w-5xl px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            합리적인 요금제
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            무료로 시작하고, 필요할 때 업그레이드하세요.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 max-w-3xl mx-auto">
          {/* Free */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-xl">{freePlan.name}</CardTitle>
              <CardDescription>{freePlan.description}</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-extrabold">$0</span>
                <span className="text-muted-foreground ml-1">/ 월</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {freePlan.features.map((f) => (
                  <li key={f.label} className="flex items-center gap-2 text-sm">
                    {f.included
                      ? <Check className="h-4 w-4 text-green-500 shrink-0" />
                      : <X className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
                    <span className={f.included ? '' : 'text-muted-foreground/60'}>{f.label}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Link href="/signup" className={`w-full text-center ${buttonVariants({ variant: 'outline' })}`}>
                무료로 시작하기
              </Link>
            </CardFooter>
          </Card>

          {/* Pro */}
          <Card className="relative border-indigo-500 shadow-xl shadow-indigo-500/20 scale-[1.03]">
            <CardHeader className="relative">
              <div className="absolute top-3 right-3">
                <Badge className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-600 hover:to-violet-600 text-white px-3 py-0.5 text-xs shadow-sm">
                  인기
                </Badge>
              </div>
              <CardTitle className="text-xl">{proPlan.name}</CardTitle>
              <CardDescription>{proPlan.description}</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-extrabold">$9.99</span>
                <span className="text-muted-foreground ml-1">/ 월</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {proPlan.features.map((f) => (
                  <li key={f.label} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-indigo-500 shrink-0" />
                    {f.label}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                onClick={handleProCheckout}
                disabled={loadingPro}
              >
                {loadingPro && <LoadingSpinner className="mr-2 h-4 w-4" />}
                Pro 시작하기
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </section>
  )
}

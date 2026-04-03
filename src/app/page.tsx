import Link from 'next/link'
import { buttonVariants } from '@/lib/button-variants'
import { Hero } from '@/components/landing/Hero'
import { Features } from '@/components/landing/Features'
import { Pricing } from '@/components/landing/Pricing'
import { Footer } from '@/components/landing/Footer'
import { BrainCircuit } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <BrainCircuit className="h-4 w-4 text-white" />
            </div>
            DocuMind
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="#features" className="hover:text-foreground transition-colors">기능</Link>
            <Link href="#pricing" className="hover:text-foreground transition-colors">요금제</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              로그인
            </Link>
            <Link href="/signup" className={cn(buttonVariants({ size: 'sm' }), 'bg-indigo-600 hover:bg-indigo-700')}>
              무료로 시작하기
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Hero />
        <Features />
        <Pricing />
      </main>

      <Footer />
    </div>
  )
}

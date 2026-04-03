import Link from 'next/link'
import { BrainCircuit } from 'lucide-react'

const links = {
  '제품': [
    { label: '기능', href: '#features' },
    { label: '요금제', href: '#pricing' },
    { label: '변경 이력', href: '#' },
    { label: '로드맵', href: '#' },
  ],
  '회사': [
    { label: '소개', href: '#' },
    { label: '블로그', href: '#' },
    { label: '채용', href: '#' },
    { label: '문의', href: '#' },
  ],
  '법적 고지': [
    { label: '개인정보처리방침', href: '#' },
    { label: '이용약관', href: '#' },
    { label: '쿠키 정책', href: '#' },
  ],
}

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
                <BrainCircuit className="h-4 w-4 text-white" />
              </div>
              DocuMind
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              AI 기반 문서 분석 플랫폼. PDF, DOCX 문서를 업로드하고 즉시 인사이트를 얻으세요.
            </p>
          </div>

          {/* Links */}
          {Object.entries(links).map(([category, items]) => (
            <div key={category}>
              <h4 className="font-semibold text-sm mb-4">{category}</h4>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} DocuMind. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground">
            Powered by Next.js · Supabase
          </p>
        </div>
      </div>
    </footer>
  )
}

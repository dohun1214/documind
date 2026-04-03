import { FileText, MessageSquare, Lightbulb, Languages, History, Download } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const features = [
  {
    icon: FileText,
    title: 'AI 문서 요약',
    description: '긴 문서를 핵심만 추려서 구조화된 요약을 제공합니다. 수십 페이지를 몇 초 만에 파악하세요.',
    color: 'text-indigo-500',
    bg: 'bg-indigo-500/10',
    pro: false,
  },
  {
    icon: MessageSquare,
    title: '질의응답',
    description: '문서에 대해 자연어로 질문하면 AI가 관련 내용을 찾아 정확하게 답변합니다.',
    color: 'text-violet-500',
    bg: 'bg-violet-500/10',
    pro: false,
  },
  {
    icon: Lightbulb,
    title: '핵심 포인트 추출',
    description: '문서에서 중요한 포인트 5~10개를 자동으로 뽑아 한눈에 볼 수 있도록 정리합니다.',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    pro: false,
  },
  {
    icon: Languages,
    title: '문서 번역',
    description: '한국어↔영어 문서 번역을 AI가 문맥을 이해하며 자연스럽게 번역합니다.',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    pro: true,
  },
  {
    icon: History,
    title: '히스토리 관리',
    description: '분석한 문서와 모든 대화 기록을 보관합니다. 언제든 다시 불러와 이어서 사용하세요.',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    pro: false,
  },
  {
    icon: Download,
    title: 'PDF 내보내기',
    description: '요약, 핵심 포인트, 질의응답 결과를 깔끔한 PDF로 다운로드합니다.',
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
    pro: true,
  },
]

export function Features() {
  return (
    <section id="features" className="py-24 bg-muted/30">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            문서 분석의 모든 것
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            AI가 문서 읽기의 번거로움을 없애드립니다. 핵심에만 집중하세요.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <Card
                key={feature.title}
                className="relative border-border/50 bg-background/60 backdrop-blur-sm hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all duration-200"
              >
                {feature.pro && (
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-indigo-600 hover:bg-indigo-600 text-white text-[10px] px-2 py-0.5">Pro</Badge>
                  </div>
                )}
                <CardHeader>
                  <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${feature.bg} mb-2`}>
                    <Icon className={`h-5 w-5 ${feature.color}`} />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}

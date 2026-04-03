import { Metadata } from 'next'
import { UploadForm } from '@/components/dashboard/UploadForm'

export const metadata: Metadata = { title: '문서 업로드' }

export default function UploadPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">문서 업로드</h1>
        <p className="text-muted-foreground">PDF 또는 DOCX 파일을 업로드하면 AI가 자동으로 분석합니다.</p>
      </div>
      <UploadForm />
    </div>
  )
}

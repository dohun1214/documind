'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Upload, FileText, X, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const MAX_SIZE_MB = 20

const FILE_TYPE_NOTES: Record<string, string> = {
  pdf:  'PDF 내 이미지 분석은 이미지를 별도 업로드해주세요',
  docx: '문서 내 이미지도 AI가 분석합니다',
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function UploadForm() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  function pickFile(f: File) {
    const ext = f.name.split('.').pop()?.toLowerCase()
    const allowed = ['pdf', 'docx', 'png', 'jpg', 'jpeg', 'webp']
    if (!ext || !allowed.includes(ext)) {
      toast.error('PDF, DOCX, PNG, JPG, WEBP 파일만 지원합니다.')
      return
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`파일 크기는 ${MAX_SIZE_MB}MB 이하여야 합니다.`)
      return
    }
    setFile(f)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) pickFile(f)
  }, [])

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setUploadProgress(0)

    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 85) { clearInterval(progressInterval); return 85 }
        return prev + Math.random() * 18
      })
    }, 250)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/documents/upload', { method: 'POST', body: formData })
      clearInterval(progressInterval)
      setUploadProgress(100)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '업로드 실패')
      toast.success('업로드 완료! AI가 문서를 분석 중입니다.')
      router.push(`/dashboard/documents/${data.id}`)
    } catch (e: unknown) {
      clearInterval(progressInterval)
      setUploadProgress(0)
      toast.error(e instanceof Error ? e.message : '업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {/* Drop zone */}
        <div
          className={cn(
            'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-colors cursor-pointer',
            dragging
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 scale-[1.01]'
              : file
              ? 'border-green-400 bg-green-50 dark:bg-green-950/20'
              : 'border-muted-foreground/25 hover:border-indigo-400 hover:bg-muted/30'
          )}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !file && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f) }}
          />

          {file ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 dark:bg-green-900">
                <CheckCircle className="h-7 w-7 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-semibold">{file.name}</p>
                <p className="text-sm text-muted-foreground mt-1">{formatBytes(file.size)}</p>
              </div>
              {FILE_TYPE_NOTES[file.name.split('.').pop()?.toLowerCase() ?? ''] && (
                <p className="text-xs text-indigo-600 dark:text-indigo-400 text-center max-w-xs">
                  {FILE_TYPE_NOTES[file.name.split('.').pop()?.toLowerCase() ?? '']}
                </p>
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setFile(null) }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" /> 파일 변경
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-900">
                {dragging
                  ? <FileText className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
                  : <Upload className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
                }
              </div>
              <div>
                <p className="font-semibold">
                  {dragging ? '여기에 파일을 놓으세요' : '파일을 드래그하거나 클릭하여 선택'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  PDF, DOCX, 이미지(PNG, JPG, WEBP) · 최대 {MAX_SIZE_MB}MB
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {uploading && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>업로드 중...</span>
              <span>{Math.round(uploadProgress)}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Info */}
        <div className="rounded-lg bg-muted/40 px-4 py-3 text-xs text-muted-foreground space-y-1">
          <p>• 무료 플랜: 하루 3문서, 10페이지 이하</p>
          <p>• Pro 플랜: 무제한 문서, 200페이지까지</p>
          <p>• 업로드 후 AI가 자동으로 요약과 핵심 포인트를 생성합니다</p>
        </div>

        <Button
          className="w-full bg-indigo-600 hover:bg-indigo-700 gap-2"
          onClick={handleUpload}
          disabled={!file || uploading}
        >
          {uploading ? (
            <><LoadingSpinner className="h-4 w-4" /> 업로드 중...</>
          ) : (
            <><Upload className="h-4 w-4" /> 분석 시작하기</>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

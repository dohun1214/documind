'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileText, FileType, Clock, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Document, DocumentStatus } from '@/types'
import { useRouter } from 'next/navigation'

const statusConfig: Record<DocumentStatus, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  pending:    { label: '대기 중',   variant: 'secondary' },
  processing: { label: '분석 중',   variant: 'default' },
  ready:      { label: '분석 완료', variant: 'outline' },
  error:      { label: '오류',      variant: 'secondary' },
}

function formatBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

interface DocumentCardProps {
  document: Document
  onDelete?: (id: string) => void
}

export function DocumentCard({ document: doc, onDelete }: DocumentCardProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`"${doc.title}" 문서를 삭제할까요?`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('문서가 삭제되었습니다.')
      if (onDelete) {
        onDelete(doc.id)
      } else {
        router.refresh()
      }
    } catch {
      toast.error('삭제에 실패했습니다.')
    } finally {
      setDeleting(false)
    }
  }

  const status = statusConfig[doc.status]
  const isReady = doc.status === 'ready'

  return (
    <Card className={`group relative transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${isReady ? 'cursor-pointer' : ''}`}>
      {isReady ? (
        <Link href={`/dashboard/documents/${doc.id}`} className="absolute inset-0 z-10" aria-label={doc.title} />
      ) : null}

      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${doc.file_type === 'pdf' ? 'bg-red-100 dark:bg-red-900/40' : 'bg-blue-100 dark:bg-blue-900/40'}`}>
            {doc.file_type === 'pdf'
              ? <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
              : <FileType className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate" title={doc.title}>{doc.title}</p>
            <p className="text-xs text-muted-foreground uppercase mt-0.5">{doc.file_type}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-2">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {doc.page_count && <span>{doc.page_count}페이지</span>}
          {doc.file_size && <span>{formatBytes(doc.file_size)}</span>}
        </div>
        {doc.summary && (
          <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {doc.summary}
          </p>
        )}
        {doc.status === 'processing' && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            AI가 문서를 분석 중입니다...
          </div>
        )}
      </CardContent>

      <CardFooter className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Badge variant={status.variant} className="text-[11px]">
            {status.label}
          </Badge>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDate(doc.created_at)}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative z-20 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          onClick={handleDelete}
          disabled={deleting}
          aria-label="삭제"
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </Button>
      </CardFooter>
    </Card>
  )
}

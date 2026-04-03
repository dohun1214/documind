'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

interface Props {
  children: string
  /** 'default': summary/full-width  'bubble': AI chat bubble (smaller padding, tighter) */
  variant?: 'default' | 'bubble'
  className?: string
}

function normalizeMarkdown(text: string): string {
  return (
    text
      // ##제목 → ## 제목 (heading requires space after #)
      .replace(/^(#{1,6})([^\s#\n])/gm, '$1 $2')
      // Ensure blank line before headings (except at start)
      .replace(/([^\n])\n(#{1,6} )/g, '$1\n\n$2')
      .trimEnd() + '\n'
  )
}

export function MarkdownContent({ children, variant = 'default', className }: Props) {
  const isBubble = variant === 'bubble'

  return (
    <div className={cn('min-w-0', className)}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      children={normalizeMarkdown(children)}
      components={{
        h1: ({ children }) => (
          <h1 className="text-base font-bold mt-4 mb-1.5 first:mt-0 leading-snug">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-sm font-bold mt-3 mb-1 first:mt-0 leading-snug">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold mt-2 mb-0.5 first:mt-0">{children}</h3>
        ),
        p: ({ children }) => (
          <p className={cn('leading-relaxed', isBubble ? 'mb-2 last:mb-0' : 'mb-3 last:mb-0')}>
            {children}
          </p>
        ),
        ul: ({ children }) => (
          <ul className={cn('list-disc pl-5 space-y-0.5', isBubble ? 'mb-2' : 'mb-3')}>
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className={cn('list-decimal pl-5 space-y-0.5', isBubble ? 'mb-2' : 'mb-3')}>
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="leading-relaxed">{children}</li>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic">{children}</em>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-indigo-300 dark:border-indigo-700 pl-3 py-0.5 my-2 text-muted-foreground italic">
            {children}
          </blockquote>
        ),
        hr: () => (
          <hr className="my-3 border-border" />
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-indigo-600 dark:text-indigo-400 underline underline-offset-2 hover:opacity-75 transition-opacity"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
        // Inline code
        code: ({ children, className: codeClass }) => {
          if (codeClass) {
            // Inside <pre> block — styled by the pre component
            return <code className={cn('font-mono text-xs', codeClass)}>{children}</code>
          }
          return (
            <code className={cn(
              'font-mono text-xs rounded px-1 py-0.5',
              isBubble
                ? 'bg-black/10 dark:bg-white/10'
                : 'bg-muted text-foreground border border-border/60'
            )}>
              {children}
            </code>
          )
        },
        // Code block wrapper
        pre: ({ children }) => (
          <pre className={cn(
            'rounded-lg p-3 overflow-x-auto my-2 text-xs font-mono leading-relaxed',
            isBubble
              ? 'bg-black/10 dark:bg-white/10'
              : 'bg-muted border border-border/60'
          )}>
            {children}
          </pre>
        ),
        // Table
        table: ({ children }) => (
          <div className="overflow-x-auto my-3">
            <table className="w-full text-xs border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-muted/60">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="border border-border px-3 py-1.5 text-left font-semibold">{children}</th>
        ),
        td: ({ children }) => (
          <td className="border border-border px-3 py-1.5">{children}</td>
        ),
      }}
    />
    </div>
  )
}

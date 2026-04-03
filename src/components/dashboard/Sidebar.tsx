'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Settings,
  CreditCard,
  BrainCircuit,
  Menu,
  Upload,
} from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { useState } from 'react'

const navItems = [
  { href: '/dashboard', label: '내 문서', icon: LayoutDashboard },
  { href: '/dashboard/upload', label: '문서 업로드', icon: Upload },
  { href: '/dashboard/settings', label: '설정', icon: Settings },
  { href: '/dashboard/billing', label: '구독 관리', icon: CreditCard },
]

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="space-y-1 px-3">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 px-6 border-b">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600">
          <BrainCircuit className="h-4 w-4 text-white" />
        </div>
        <span className="font-bold text-base">DocuMind</span>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-4">
        <NavLinks onNavigate={onNavigate} />
      </div>
    </div>
  )
}

export function Sidebar() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-background">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar — SheetTrigger uses render prop (Base UI) */}
      <div className="flex md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <button
                className="fixed top-4 left-4 z-50 inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted transition-colors"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            }
          />
          <SheetContent side="left" className="w-64 p-0">
            <SidebarContent onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}

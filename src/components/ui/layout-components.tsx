import * as React from "react"
import { GlassCard } from "@/components/ui/glass-card"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: number | string
  className?: string
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ label, value, className }, ref) => (
    <GlassCard
      ref={ref}
      variant="dark"
      className={cn("p-3 flex flex-col gap-1", className)}
    >
      <div className="text-slate-300 text-xs">{label}</div>
      <div className="text-lg font-semibold tabular-nums text-white">{value}</div>
    </GlassCard>
  )
)
StatCard.displayName = "StatCard"

interface SectionHeaderProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode
  size?: 'lg' | 'xl'
}

const SectionHeader = React.forwardRef<HTMLHeadingElement, SectionHeaderProps>(
  ({ className, children, size = 'xl', ...props }, ref) => {
    const sizes = {
      lg: "text-lg",
      xl: "text-xl"
    }

    return (
      <h2
        ref={ref}
        className={cn("font-semibold text-white", sizes[size], className)}
        {...props}
      >
        {children}
      </h2>
    )
  }
)
SectionHeader.displayName = "SectionHeader"

interface ContentSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  children: React.ReactNode
  headerSize?: 'lg' | 'xl'
}

const ContentSection = React.forwardRef<HTMLDivElement, ContentSectionProps>(
  ({ className, title, children, headerSize = 'xl', ...props }, ref) => (
    <GlassCard ref={ref} className={cn("p-4 md:p-6", className)} {...props}>
      {title && (
        <SectionHeader size={headerSize} className="mb-4">
          {title}
        </SectionHeader>
      )}
      {children}
    </GlassCard>
  )
)
ContentSection.displayName = "ContentSection"

export { StatCard, SectionHeader, ContentSection }

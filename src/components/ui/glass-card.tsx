import * as React from "react"
import { cn } from "@/lib/utils"

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'subtle' | 'dark'
  children: React.ReactNode
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variants = {
      default: "bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl shadow-black/50",
      subtle: "bg-white/5 backdrop-blur-sm border border-white/10 shadow-lg",
      dark: "bg-white/10 backdrop-blur-sm border border-white/20 shadow-lg"
    }

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl",
          variants[variant],
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
GlassCard.displayName = "GlassCard"

export { GlassCard }

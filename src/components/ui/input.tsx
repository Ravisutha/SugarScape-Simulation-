import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full min-w-0 rounded-md bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-1 text-base text-white placeholder:text-slate-300 shadow-lg transition-all duration-200 outline-none hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-emerald-400/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-white",
        className
      )}
      {...props}
    />
  )
}

export { Input }

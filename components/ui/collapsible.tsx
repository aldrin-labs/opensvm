"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface CollapsibleContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CollapsibleContext = React.createContext<CollapsibleContextValue | null>(null)

const useCollapsible = () => {
  const context = React.useContext(CollapsibleContext)
  if (!context) {
    throw new Error("useCollapsible must be used within a Collapsible")
  }
  return context
}

interface CollapsibleProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
  className?: string
}

const Collapsible = React.forwardRef<HTMLDivElement, CollapsibleProps>(
  ({ open = false, onOpenChange, children, className, ...props }, ref) => {
    const [internalOpen, setInternalOpen] = React.useState(open)
    
    const isControlled = onOpenChange !== undefined
    const isOpen = isControlled ? open : internalOpen
    
    const handleOpenChange = React.useCallback((newOpen: boolean) => {
      if (isControlled) {
        onOpenChange?.(newOpen)
      } else {
        setInternalOpen(newOpen)
      }
    }, [isControlled, onOpenChange])

    const contextValue = React.useMemo(() => ({
      open: isOpen,
      onOpenChange: handleOpenChange
    }), [isOpen, handleOpenChange])

    return (
      <CollapsibleContext.Provider value={contextValue}>
        <div ref={ref} className={cn("", className)} {...props}>
          {children}
        </div>
      </CollapsibleContext.Provider>
    )
  }
)
Collapsible.displayName = "Collapsible"

const CollapsibleTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const { onOpenChange, open } = useCollapsible()
  
  return (
    <button
      ref={ref}
      className={cn("", className)}
      onClick={() => onOpenChange(!open)}
      {...props}
    >
      {children}
    </button>
  )
})
CollapsibleTrigger.displayName = "CollapsibleTrigger"

const CollapsibleContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { open } = useCollapsible()
  
  if (!open) return null
  
  return (
    <div
      ref={ref}
      className={cn("", className)}
      {...props}
    >
      {children}
    </div>
  )
})
CollapsibleContent.displayName = "CollapsibleContent"

export { Collapsible, CollapsibleTrigger, CollapsibleContent }

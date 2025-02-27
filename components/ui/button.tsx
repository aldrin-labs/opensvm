import * as React from "react"
import { cn } from "@/lib/utils"

export type ButtonVariant = 'default' | 'outline' | 'ghost' | 'link' | 'destructive';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const destructiveStyles = "bg-destructive text-destructive-foreground hover:bg-destructive/90";

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-primary text-primary-foreground hover:bg-primary/90": variant === 'default',
            "border border-border bg-background hover:bg-accent hover:text-accent-foreground": variant === 'outline',
            "hover:bg-accent hover:text-accent-foreground": variant === 'ghost',
            "text-primary underline-offset-4 hover:underline": variant === 'link',
            "h-9 px-3": size === 'sm',
            "h-10 px-4 py-2": size === 'default',
            "h-11 px-8": size === 'lg',
            "h-8 w-8 p-0": size === 'icon',
          },
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

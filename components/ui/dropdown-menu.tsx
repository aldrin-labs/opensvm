"use client"

import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"

const DropdownMenu = DropdownMenuPrimitive.Root

const DropdownMenuTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Trigger
    ref={ref}
    className={`outline-none ${className}`}
    {...props}
  />
))
DropdownMenuTrigger.displayName = DropdownMenuPrimitive.Trigger.displayName

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => {
  const w = typeof window !== 'undefined' ? (window as any) : undefined;
  const force = w && w.__E2E_FORCE_DROPDOWN_MOUNT === true ? true : undefined;
  const inline = w && w.__E2E_INLINE_DROPDOWN === true;
  const content = (
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={`
        z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-background p-1 shadow-md
        animate-in fade-in-0 zoom-in-95
        ${className}
      `}
      role="menu"
      forceMount={force}
      {...props}
    />
  );
  return inline ? content : (
    <DropdownMenuPrimitive.Portal>
      {content}
    </DropdownMenuPrimitive.Portal>
  );
})
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { preventClose?: boolean }
>(({ className, preventClose, onClick, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={`
      relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none 
      transition-colors focus:bg-secondary focus:text-secondary-foreground data-[disabled]:pointer-events-none 
      data-[disabled]:opacity-50 cursor-pointer
      ${className}
    `}
    onClick={(e) => {
      if (preventClose) {
        e.preventDefault();
        e.stopPropagation();
      }
      onClick?.(e);
    }}
    {...props}
  />
))
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={`px-2 py-1.5 text-sm font-semibold ${className}`}
    {...props}
  />
))
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={`-mx-1 my-1 h-px bg-border ${className}`}
    {...props}
  />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

const DropdownMenuSub = DropdownMenuPrimitive.Sub

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={`
      flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none 
      focus:bg-secondary data-[state=open]:bg-secondary cursor-pointer
      ${className}
    `}
    {...props}
  >
    {children}
    <span className="ml-auto h-4 w-4">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m9 18 6-6-6-6" />
      </svg>
    </span>
  </DropdownMenuPrimitive.SubTrigger>
))
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => {
  const w = typeof window !== 'undefined' ? (window as any) : undefined;
  const force = w && w.__E2E_FORCE_DROPDOWN_MOUNT === true ? true : undefined;
  const inline = w && w.__E2E_INLINE_DROPDOWN === true;
  const content = (
    <DropdownMenuPrimitive.SubContent
      ref={ref}
      className={`
        z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-background p-1 shadow-md
        animate-in fade-in-0 zoom-in-95 transition-all duration-200
        ${className}
      `}
      forceMount={force}
      {...props}
    />
  );
  return inline ? content : content;
})
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName

const DropdownMenuPortal = DropdownMenuPrimitive.Portal

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
}

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "shadcn-ui-utils"

const labelVariants = cva(
  "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "",
        eyebrow: "font-sans text-[11px] leading-[14px] font-semibold tracking-[1.2px] uppercase text-content-secondary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Label({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"label"> & VariantProps<typeof labelVariants>) {
  return (
    <label
      data-slot="label"
      className={cn(labelVariants({ variant, className }))}
      {...props}
    />
  )
}

export { Label, labelVariants }

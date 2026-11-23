import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all outline-none select-none focus-visible:ring-[3px] focus-visible:ring-brand/30 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-brand-hover active:translate-y-px",
        navy: "bg-navy text-white shadow-sm hover:bg-navy-soft",
        destructive: "bg-danger text-white shadow-sm hover:bg-danger/90",
        outline: "border bg-white text-ink shadow-xs hover:bg-surface-muted",
        secondary: "bg-surface-muted text-ink hover:bg-line/70",
        ghost: "text-ink hover:bg-surface-muted",
        link: "text-brand underline-offset-4 hover:underline px-0",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 px-6 text-base",
        xl: "h-14 px-8 text-base",
        icon: "size-10",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

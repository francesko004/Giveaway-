import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", {
  variants: {
    variant: {
      default: "border-transparent bg-brand-soft text-brand",
      success: "border-transparent bg-success-soft text-success",
      danger: "border-transparent bg-danger-soft text-danger",
      warning: "border-transparent bg-warning-soft text-warning",
      neutral: "border-transparent bg-surface-muted text-ink-muted",
      navy: "border-transparent bg-navy text-white",
      outline: "bg-white text-ink",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

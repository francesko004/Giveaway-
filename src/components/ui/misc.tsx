import * as React from "react";
import { cn } from "@/lib/utils";

export function Separator({ className, ...props }: React.ComponentProps<"hr">) {
  return <hr className={cn("border-0 border-t", className)} {...props} />;
}

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("animate-pulse rounded-lg bg-surface-muted", className)} {...props} />;
}

export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}
export function THead({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("bg-surface-muted/70 [&_tr]:border-b", className)} {...props} />;
}
export function TBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}
export function TR({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr className={cn("border-b transition-colors hover:bg-surface-muted/50", className)} {...props} />;
}
export function TH({ className, ...props }: React.ComponentProps<"th">) {
  return <th className={cn("h-10 px-4 text-left align-middle text-xs font-semibold tracking-wide whitespace-nowrap text-ink-muted uppercase", className)} {...props} />;
}
export function TD({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("px-4 py-3 align-middle", className)} {...props} />;
}

export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icon && <div className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">{icon}</div>}
      <div>
        <p className="font-semibold text-navy">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Field({ label, htmlFor, hint, error, children, className }: { label: React.ReactNode; htmlFor?: string; hint?: React.ReactNode; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

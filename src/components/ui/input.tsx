import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full min-w-0 rounded-lg border bg-white px-3.5 text-base text-ink shadow-xs transition-[color,box-shadow] outline-none placeholder:text-ink-muted/70 sm:text-sm",
        "focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/20",
        "aria-invalid:border-danger aria-invalid:ring-danger/15 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70",
        "file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-24 w-full rounded-lg border bg-white px-3.5 py-2.5 text-base text-ink shadow-xs outline-none placeholder:text-ink-muted/70 sm:text-sm",
        "focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/20 aria-invalid:border-danger disabled:opacity-70",
        className,
      )}
      {...props}
    />
  );
}

export function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "flex h-10 w-full appearance-none rounded-lg border bg-white bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9 pl-3 text-sm text-ink shadow-xs outline-none",
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23667085' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        "focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/20 disabled:opacity-60",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

"use client";
import * as React from "react";
import { DropdownMenu as DM } from "radix-ui";
import { cn } from "@/lib/utils";

export const DropdownMenu = DM.Root;
export const DropdownMenuTrigger = DM.Trigger;
export function DropdownMenuContent({ className, sideOffset = 6, ...props }: React.ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content sideOffset={sideOffset} className={cn("z-50 min-w-44 overflow-hidden rounded-xl border bg-white p-1 shadow-elevated data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95", className)} {...props} />
    </DM.Portal>
  );
}
export function DropdownMenuItem({ className, ...props }: React.ComponentProps<typeof DM.Item>) {
  return <DM.Item className={cn("flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm text-ink outline-none select-none data-[highlighted]:bg-surface-muted data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-ink-muted", className)} {...props} />;
}
export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof DM.Label>) {
  return <DM.Label className={cn("px-2.5 py-1.5 text-xs font-semibold text-ink-muted", className)} {...props} />;
}
export function DropdownMenuSeparator(props: React.ComponentProps<typeof DM.Separator>) {
  return <DM.Separator className="my-1 h-px bg-line" {...props} />;
}

"use client";
import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;
export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn("inline-flex h-10 items-center gap-1 rounded-lg bg-surface-muted p-1", className)} {...props} />;
}
export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn("inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-ink-muted transition data-[state=active]:bg-white data-[state=active]:text-navy data-[state=active]:shadow-sm", className)}
      {...props}
    />
  );
}
export const TabsContent = TabsPrimitive.Content;

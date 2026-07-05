"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "./utils";

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        // max-w-full + overflow-x-auto: on narrow screens a long tab row
        // scrolls inside its own box instead of widening the page. No
        // visual change when the tabs fit.
        "inline-flex h-10 w-fit max-w-full items-center justify-start overflow-x-auto rounded-lg p-1 flex gap-1",
        className,
      )}
      style={{ backgroundColor: '#f1f5f9' }}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const isActive = props['data-state'] === 'active';
  
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        // shrink-0: when the list is narrower than its tabs (phones), the
        // row scrolls instead of the triggers being squashed/clipped.
        "inline-flex h-full shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent px-4 py-2 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      style={{
        backgroundColor: isActive ? '#ffffff' : 'transparent',
        color: isActive ? '#0f172a' : '#475569',
        fontWeight: isActive ? 600 : 500,
        boxShadow: isActive ? '0 1px 2px 0 rgb(0 0 0 / 0.05)' : 'none'
      }}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
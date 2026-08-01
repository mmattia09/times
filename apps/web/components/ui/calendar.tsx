"use client";

import { DayPicker, type DayPickerProps } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The app's month grid, on react-day-picker.
 *
 * Kept as a plain wrapper over the library: weekday names, month captions,
 * keyboard navigation and the locale all come from there. Only the styling is
 * ours — and `timeZone="utc"`, because a session date is a calendar day and
 * must not shift with the reader's zone (see lib/timezone.ts).
 */
export function Calendar({ className, classNames, ...props }: DayPickerProps) {
  return (
    <DayPicker
      timeZone="utc"
      weekStartsOn={1}
      showOutsideDays
      className={cn("w-full", className)}
      classNames={{
        months: "flex w-full flex-col",
        month: "w-full space-y-3",
        month_caption: "flex h-9 items-center justify-center",
        caption_label: "text-sm font-semibold capitalize",
        nav: "flex items-center justify-between absolute inset-x-0 top-0 h-9 pointer-events-none",
        button_previous:
          "pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40",
        button_next:
          "pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40",
        month_grid: "w-full border-collapse",
        weekdays: "flex w-full",
        weekday:
          "flex-1 pb-1 text-center text-[11px] font-medium uppercase text-muted-foreground",
        week: "flex w-full",
        day: "flex-1 p-0.5 text-center text-sm",
        outside: "text-muted-foreground/40",
        disabled: "opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
        ...props.components,
      }}
      {...props}
    />
  );
}

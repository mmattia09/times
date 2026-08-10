import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * text-base on a phone, text-sm from sm up.
 *
 * Not a taste decision: iOS Safari zooms the page in when you focus an input
 * whose text is under 16px, and then leaves you zoomed — which is what made
 * filling in a session at the track feel like fighting the browser. 16px is the
 * threshold, so the small screen gets 16px and everything else keeps 14.
 */
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-base shadow-sm transition-colors sm:text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };

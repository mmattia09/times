"use client";

import { useEffect, useRef } from "react";

/**
 * ⌘/Ctrl + Enter saves, from anywhere on the page.
 *
 * Listening on the <form> only catches keystrokes that bubble out of it, so the
 * shortcut quietly died whenever the focus was somewhere else — on the body
 * after clicking empty space, or inside one of Radix's popups, which render at
 * the end of the document rather than inside the form. Listening on the
 * document is what "from anywhere" actually means.
 */
export function useSubmitShortcut(onSubmit: () => void, enabled = true): void {
  // Kept in a ref so the listener isn't torn down and re-added every render.
  // Updated in an effect, not during render: React reserves refs for effects.
  const latest = useRef(onSubmit);
  useEffect(() => {
    latest.current = onSubmit;
  });

  useEffect(() => {
    if (!enabled) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey)) return;
      // While a dialog is open it owns the keyboard: saving the form behind it
      // is never what the shortcut means.
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      event.preventDefault();
      latest.current();
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [enabled]);
}

import { useEffect } from "react";

type ShortcutMap = Record<string, (e: KeyboardEvent) => void>;

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target;
  if (t instanceof HTMLInputElement) return true;
  if (t instanceof HTMLTextAreaElement) return true;
  if (t instanceof HTMLElement && t.isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (isTyping(e)) return;

      const fn = shortcuts[e.key];
      if (fn) {
        e.preventDefault();
        fn(e);
      }
    }

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [shortcuts]);
}

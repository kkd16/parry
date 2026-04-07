import { useEffect, useLayoutEffect, useRef } from "react";

type Handler = () => void;

interface Handlers {
  onGoBridge?: Handler;
  onGoEvents?: Handler;
  onGoSolar?: Handler;
  onGoPolicy?: Handler;
  onGoNotify?: Handler;
  onOpenPalette?: Handler;
  onFocusSearch?: Handler;
  onShowHelp?: Handler;
  onEscape?: Handler;
}

export function useKeyboardNav(handlers: Handlers) {
  const ref = useRef(handlers);
  useLayoutEffect(() => {
    ref.current = handlers;
  }, [handlers]);

  useEffect(() => {
    let leader = false;
    let leaderTimer: ReturnType<typeof setTimeout> | null = null;

    const resetLeader = () => {
      leader = false;
      if (leaderTimer) {
        clearTimeout(leaderTimer);
        leaderTimer = null;
      }
    };

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && (e.code === "Space" || e.key === " ")) {
        e.preventDefault();
        ref.current.onOpenPalette?.();
        return;
      }

      if (e.key === "Escape") {
        ref.current.onEscape?.();
        resetLeader();
        return;
      }

      if (isEditable) return;

      if (e.key === "/") {
        e.preventDefault();
        ref.current.onFocusSearch?.();
        return;
      }

      if (e.key === "?") {
        e.preventDefault();
        ref.current.onShowHelp?.();
        return;
      }

      if (leader) {
        if (e.key === "b") ref.current.onGoBridge?.();
        else if (e.key === "e") ref.current.onGoEvents?.();
        else if (e.key === "s") ref.current.onGoSolar?.();
        else if (e.key === "p") ref.current.onGoPolicy?.();
        else if (e.key === "n") ref.current.onGoNotify?.();
        resetLeader();
        return;
      }

      if (e.key === "g") {
        leader = true;
        leaderTimer = setTimeout(resetLeader, 900);
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (leaderTimer) clearTimeout(leaderTimer);
    };
  }, []);
}

"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export type DisplayMode =
  | "inline"
  | "native-fullscreen"
  | "viewport-fullscreen";

const DESKTOP_FULLSCREEN_QUERY = "(min-width: 1024px) and (pointer: fine)";

type UseGameFullscreenOptions = Readonly<{
  shellRef: RefObject<HTMLElement | null>;
  onFullscreenExit: () => void;
}>;

function safelyExitNativeFullscreen(element: HTMLElement | null) {
  if (typeof document === "undefined" || document.fullscreenElement !== element) return;
  try {
    const exitPromise = document.exitFullscreen?.();
    if (exitPromise) void exitPromise.catch(() => undefined);
  } catch {
    // The document may already be leaving fullscreen during route teardown.
  }
}

export function useGameFullscreen({
  shellRef,
  onFullscreenExit,
}: UseGameFullscreenOptions) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>("inline");
  const [isDesktopFullscreenEligible, setIsDesktopFullscreenEligible] = useState(false);
  const displayModeRef = useRef<DisplayMode>("inline");
  const eligibleRef = useRef(false);
  const mountedRef = useRef(false);
  const onFullscreenExitRef = useRef(onFullscreenExit);

  useEffect(() => {
    onFullscreenExitRef.current = onFullscreenExit;
  }, [onFullscreenExit]);

  const updateDisplayMode = useCallback((nextMode: DisplayMode) => {
    displayModeRef.current = nextMode;
    if (mountedRef.current) setDisplayMode(nextMode);
  }, []);

  const activateViewportFallback = useCallback(() => {
    if (!mountedRef.current || !eligibleRef.current) return;
    updateDisplayMode("viewport-fullscreen");
  }, [updateDisplayMode]);

  useEffect(() => {
    mountedRef.current = true;
    const query = window.matchMedia(DESKTOP_FULLSCREEN_QUERY);

    const syncEligibility = () => {
      eligibleRef.current = query.matches;
      setIsDesktopFullscreenEligible(query.matches);

      if (!query.matches && displayModeRef.current === "viewport-fullscreen") {
        updateDisplayMode("inline");
        onFullscreenExitRef.current();
      }
    };

    syncEligibility();
    query.addEventListener("change", syncEligibility);

    return () => {
      query.removeEventListener("change", syncEligibility);
      mountedRef.current = false;
      eligibleRef.current = false;
    };
  }, [updateDisplayMode]);

  useEffect(() => {
    const shell = shellRef.current;

    const onFullscreenChange = () => {
      if (document.fullscreenElement === shell) {
        updateDisplayMode("native-fullscreen");
        return;
      }

      if (displayModeRef.current === "native-fullscreen") {
        updateDisplayMode("inline");
        onFullscreenExitRef.current();
      }
    };

    const onFullscreenError = () => {
      if (displayModeRef.current === "native-fullscreen") activateViewportFallback();
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("fullscreenerror", onFullscreenError);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("fullscreenerror", onFullscreenError);
      safelyExitNativeFullscreen(shell);
    };
  }, [activateViewportFallback, shellRef, updateDisplayMode]);

  useEffect(() => {
    if (displayMode === "inline") return;

    const previousDocumentOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = previousDocumentOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [displayMode]);

  const enterDesktopFullscreen = useCallback(() => {
    const shell = shellRef.current;
    if (!shell || !eligibleRef.current) return false;

    if (document.fullscreenElement === shell) {
      updateDisplayMode("native-fullscreen");
      return true;
    }

    if (
      document.fullscreenEnabled === false ||
      typeof shell.requestFullscreen !== "function"
    ) {
      activateViewportFallback();
      return true;
    }

    updateDisplayMode("native-fullscreen");

    try {
      const request = shell.requestFullscreen({ navigationUI: "hide" });
      void Promise.resolve(request).catch(() => {
        if (
          displayModeRef.current === "native-fullscreen" &&
          document.fullscreenElement !== shell
        ) {
          activateViewportFallback();
        }
      });
    } catch {
      activateViewportFallback();
    }

    return true;
  }, [activateViewportFallback, shellRef, updateDisplayMode]);

  const exitDesktopFullscreen = useCallback(() => {
    const shell = shellRef.current;

    if (
      displayModeRef.current === "native-fullscreen" &&
      document.fullscreenElement === shell
    ) {
      try {
        const exitPromise = document.exitFullscreen?.();
        if (exitPromise) {
          void exitPromise.catch(() => {
            updateDisplayMode("inline");
            onFullscreenExitRef.current();
          });
          return;
        }
      } catch {
        // Fall through to the deterministic inline cleanup below.
      }

      updateDisplayMode("inline");
      onFullscreenExitRef.current();
      return;
    }

    if (displayModeRef.current !== "inline") {
      updateDisplayMode("inline");
      onFullscreenExitRef.current();
    }
  }, [shellRef, updateDisplayMode]);

  return {
    displayMode,
    isDesktopFullscreenEligible,
    enterDesktopFullscreen,
    exitDesktopFullscreen,
  } as const;
}

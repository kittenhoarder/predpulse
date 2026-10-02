"use client";
import { useSyncExternalStore } from "react";
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (change) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", change);
      return () => media.removeEventListener("change", change);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

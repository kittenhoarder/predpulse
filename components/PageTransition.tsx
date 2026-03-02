"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Wraps page content with a fade-in/slide-up entrance animation on every
 * route change. Uses a key derived from the pathname so React remounts the
 * wrapper — triggering the CSS animation — whenever the route changes.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Increment a counter on each pathname change so the animation key is always
  // unique and the element is actually remounted (not just re-rendered).
  const countRef = useRef(0);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    countRef.current += 1;
    setAnimKey(countRef.current);
  }, [pathname]);

  return (
    <div key={animKey} className="page-enter">
      {children}
    </div>
  );
}

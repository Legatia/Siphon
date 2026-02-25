"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function RouteTransitionShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const lastPathRef = useRef(pathname);
  const [transitionKey, setTransitionKey] = useState(0);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;
    setTransitionKey((k) => k + 1);
    setFlash(true);
    const timeout = window.setTimeout(() => setFlash(false), 320);
    return () => window.clearTimeout(timeout);
  }, [pathname]);

  return (
    <div className="relative">
      <div key={transitionKey} className="animate-[route-content-in_360ms_cubic-bezier(0.16,1,0.3,1)_both]">
        {children}
      </div>
      {flash && <div className="pointer-events-none fixed inset-0 z-[66] animate-[route-flash_320ms_ease-out_forwards]" />}
    </div>
  );
}

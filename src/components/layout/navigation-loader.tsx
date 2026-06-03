"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function NavigationLoader() {
  const [isLoading, setIsLoading] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsLoading(true);
    const timeout = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timeout);
  }, [pathname]);

  return (
    <>
      {isLoading && (
        <div className="fixed top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-500 animate-pulse z-50" />
      )}
    </>
  );
}

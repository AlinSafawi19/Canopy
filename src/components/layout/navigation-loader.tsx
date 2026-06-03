"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function NavigationLoader() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const handleStart = () => {
      setIsLoading(true);
    };

    const handleStop = () => {
      timeout = setTimeout(() => setIsLoading(false), 500);
    };

    // Listen to router events
    router.prefetch = new Proxy(router.prefetch, {
      apply(target, thisArg, args) {
        handleStart();
        const promise = target.apply(thisArg, args);
        promise?.finally?.(handleStop);
        return promise;
      },
    });

    // Also use a more reliable approach: watch for URL changes
    let previousPath = typeof window !== "undefined" ? window.location.pathname : "";

    const checkUrlChange = () => {
      const currentPath = window.location.pathname;
      if (currentPath !== previousPath) {
        previousPath = currentPath;
        setIsLoading(true);
        timeout = setTimeout(() => setIsLoading(false), 500);
      }
    };

    const interval = setInterval(checkUrlChange, 100);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <>
      {isLoading && (
        <div className="fixed top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-500 animate-pulse z-50" />
      )}
    </>
  );
}

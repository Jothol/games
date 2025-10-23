"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

// Keep / public so users can enter the key.
// Add paths here if you want them public too (e.g., "/trivia/display").
const PUBLIC_PATHS = new Set<string>(["/"]);

export default function ClientAuthGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      const isPublic = PUBLIC_PATHS.has(pathname);
      if (isPublic || u) {
        setOk(true);
      } else {
        setOk(false);
        router.replace("/"); // send to key entry
      }
    });
    return () => unsub();
  }, [pathname, router]);

  if (!ok) return <main className="min-h-screen p-6">Loading…</main>;
  return <>{children}</>;
}

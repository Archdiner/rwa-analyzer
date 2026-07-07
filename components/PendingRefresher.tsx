"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * When qualitative extraction is still running (deferred after the first load),
 * refresh the server component once after a short delay so the freshly-filled
 * dimensions appear without a manual reload.
 */
export default function PendingRefresher({ delayMs = 7000 }: { delayMs?: number }) {
    const router = useRouter();
    useEffect(() => {
        const t = setTimeout(() => router.refresh(), delayMs);
        return () => clearTimeout(t);
    }, [router, delayMs]);
    return null;
}

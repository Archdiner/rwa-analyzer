"use client";

import { useEffect, useRef, useState } from "react";

/**
 * IntersectionObserver wrapper. Returns a ref to attach and whether the element
 * is currently on (or near) screen. Used to pause offscreen canvas rAF loops —
 * never run multiple ASCII fields at once.
 */
export function useInViewport<T extends HTMLElement = HTMLDivElement>(
    rootMargin = "200px",
): { ref: React.RefObject<T | null>; inView: boolean } {
    const ref = useRef<T | null>(null);
    const [inView, setInView] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el || typeof IntersectionObserver === "undefined") return;
        // setState lives in the observer callback (async), not the effect body.
        const io = new IntersectionObserver(
            ([entry]) => setInView(entry.isIntersecting),
            { rootMargin },
        );
        io.observe(el);
        return () => io.disconnect();
    }, [rootMargin]);

    return { ref, inView };
}

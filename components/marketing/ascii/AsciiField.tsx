"use client";

/* -----------------------------------------------------------------------------
   AsciiField — the "noise resolves into proof" canvas engine.
   -----------------------------------------------------------------------------
   Renders a source image (or procedural draw) as a halftone dot / glyph field on
   a near-black ground. A `resolve` value in [0,1] blends per-cell between animated
   static (0) and the sampled image (1); cells resolve on staggered thresholds so
   the dissolve reads organic. Driven imperatively from a framer MotionValue via a
   single rAF loop — React renders this component once. Gated by viewport +
   prefers-reduced-motion.
--------------------------------------------------------------------------------*/

import { useEffect, useRef } from "react";
import { type MotionValue, useMotionValue, useMotionValueEvent } from "framer-motion";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { useInViewport } from "../hooks/useInViewport";

const RAMP = " .:-=+*#%@";
const TAU = Math.PI * 2;
const INK = "#f4f3ef";

type Mode = "dots" | "glyphs";

export type AsciiFieldProps = {
    /** Same-origin image path to sample (e.g. "/vault-dithered.png"). */
    src?: string;
    /** Optional procedural painter (draws into an offscreen cols×rows canvas). */
    paint?: (ctx: CanvasRenderingContext2D, cols: number, rows: number) => void;
    /** Scroll-bound resolve amount in [0,1]. Omit for a static field. */
    progress?: MotionValue<number>;
    /** Max resolve when static / at progress=1. 1 = fully resolves, <1 stays noisy. */
    resolvedTo?: number;
    mode?: Mode;
    ink?: string;
    /** Flip luminance (bright↔dark) if the source polarity is inverted. */
    invert?: boolean;
    className?: string;
    /** Approx. horizontal cell count on desktop; scaled down on small canvases. */
    baseCols?: number;
    style?: React.CSSProperties;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export default function AsciiField({
    src,
    paint,
    progress,
    resolvedTo = 1,
    mode = "dots",
    ink = INK,
    invert = false,
    className = "",
    baseCols = 108,
    style,
}: AsciiFieldProps) {
    const reduced = useReducedMotion();
    const { ref: viewRef, inView } = useInViewport<HTMLDivElement>("300px");
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    // Live resolve value, written outside React.
    const fallback = useMotionValue(0);
    const mv = progress ?? fallback;
    const progressRef = useRef(0);
    useMotionValueEvent(mv, "change", (v) => {
        progressRef.current = v;
    });

    useEffect(() => {
        const wrap = viewRef.current;
        const canvas = canvasRef.current;
        if (!wrap || !canvas) return;
        const ctx = canvas.getContext("2d", { alpha: true });
        if (!ctx) return;

        let cols = 0;
        let rows = 0;
        let cell = 0;
        let luma = new Float32Array(0);
        let threshold = new Float32Array(0);
        let cssW = 0;
        let cssH = 0;
        let source: HTMLImageElement | null = null;
        let raf = 0;
        let lastRv = -1;
        let drew = false;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        function sample() {
            cssW = wrap!.clientWidth;
            cssH = wrap!.clientHeight;
            if (cssW === 0 || cssH === 0) return;
            cols = Math.max(38, Math.min(baseCols, Math.round(cssW / 13)));
            cell = cssW / cols;
            rows = Math.max(1, Math.round(cssH / cell));

            canvas!.width = Math.round(cssW * dpr);
            canvas!.height = Math.round(cssH * dpr);
            canvas!.style.width = `${cssW}px`;
            canvas!.style.height = `${cssH}px`;
            ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

            // Downsample source (or procedural) into a cols×rows grid, once.
            const off = document.createElement("canvas");
            off.width = cols;
            off.height = rows;
            const octx = off.getContext("2d");
            luma = new Float32Array(cols * rows);
            if (octx) {
                if (source) octx.drawImage(source, 0, 0, cols, rows);
                else if (paint) paint(octx, cols, rows);
                if (source || paint) {
                    const data = octx.getImageData(0, 0, cols, rows).data;
                    for (let i = 0; i < cols * rows; i++) {
                        const r = data[i * 4];
                        const g = data[i * 4 + 1];
                        const b = data[i * 4 + 2];
                        const a = data[i * 4 + 3] / 255;
                        let l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                        l *= a;
                        // Contrast stretch so mid-tone subjects (the vault) read
                        // as they resolve instead of staying muddy grey.
                        l = clamp01((l - 0.1) / 0.72);
                        luma[i] = invert ? 1 - l : l;
                    }
                }
            }

            // Per-cell resolve threshold: top resolves first, jittered.
            threshold = new Float32Array(cols * rows);
            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    const i = y * cols + x;
                    const vgrad = y / Math.max(1, rows - 1);
                    threshold[i] = clamp01(0.58 * vgrad + 0.42 * pseudo(i * 2.17));
                }
            }
            lastRv = -1;
            drew = false;
        }

        // Deterministic per-cell hash → [0,1].
        function pseudo(n: number) {
            const s = Math.sin(n * 12.9898) * 43758.5453;
            return s - Math.floor(s);
        }

        function draw(rv: number, flickerStep: number, shimmering: boolean) {
            ctx!.clearRect(0, 0, cssW, cssH);
            ctx!.fillStyle = ink;
            const feather = 0.26;
            const isGlyph = mode === "glyphs";
            if (isGlyph) {
                ctx!.font = `${cell * 1.05}px var(--font-mono, monospace)`;
                ctx!.textBaseline = "top";
            }
            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    const i = y * cols + x;
                    const local = clamp01((rv - threshold[i]) / feather);
                    const n = shimmering ? pseudo(i * 3.11 + flickerStep) : 0;
                    const val = lerp(n, luma[i], local);
                    if (val < 0.05) continue;
                    const px = x * cell;
                    const py = y * cell;
                    if (isGlyph) {
                        const ci = Math.min(RAMP.length - 1, Math.floor(val * RAMP.length));
                        ctx!.globalAlpha = 0.5 + 0.5 * val;
                        ctx!.fillText(RAMP[ci], px, py);
                    } else {
                        const r = cell * 0.5 * (0.32 + 0.68 * val);
                        ctx!.globalAlpha = 0.32 + 0.68 * val;
                        ctx!.beginPath();
                        ctx!.arc(px + cell / 2, py + cell / 2, r * 0.92, 0, TAU);
                        ctx!.fill();
                    }
                }
            }
            ctx!.globalAlpha = 1;
        }

        function loop(t: number) {
            raf = requestAnimationFrame(loop);
            if (!inView || luma.length === 0) return;
            const rv = clamp01((progress ? progressRef.current : 1) * resolvedTo);
            const shimmering = rv < 0.995;
            if (!shimmering && drew && Math.abs(rv - lastRv) < 0.002) return;
            const flickerStep = Math.floor(t * 0.012); // ~12 static updates/sec
            draw(rv, flickerStep, shimmering);
            lastRv = rv;
            drew = true;
        }

        function start() {
            cancelAnimationFrame(raf);
            if (reduced) {
                // Draw one static frame at the resolved target, no animation.
                const rv = clamp01(resolvedTo);
                if (luma.length) draw(rv, 0, rv < 0.995);
                return;
            }
            raf = requestAnimationFrame(loop);
        }

        // Debounced resize.
        let resizeTimer = 0;
        const ro = new ResizeObserver(() => {
            window.clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(() => {
                sample();
                start();
            }, 120);
        });
        ro.observe(wrap);

        if (src) {
            const img = new Image();
            img.onload = () => {
                source = img;
                sample();
                start();
            };
            img.src = src;
        } else {
            sample();
            start();
        }

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            window.clearTimeout(resizeTimer);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [src, mode, invert, resolvedTo, baseCols, ink, reduced, inView, progress]);

    return (
        <div ref={viewRef} className={className} style={{ position: "relative", ...style }} aria-hidden>
            <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
        </div>
    );
}

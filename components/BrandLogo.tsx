"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";

const LOGO = "/white-logo.jpg";
const LOGO_ANIM = "/logo-animation.mp4";

export default function BrandLogo() {
    const [hovered, setHovered] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    function onEnter() {
        setHovered(true);
        const v = videoRef.current;
        if (!v) return;
        v.currentTime = 0;
        void v.play();
    }

    function onLeave() {
        setHovered(false);
        const v = videoRef.current;
        if (!v) return;
        v.pause();
        v.currentTime = 0;
    }

    return (
        <Link
            href="/"
            aria-label="Home"
            className="group inline-flex items-center"
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            onFocus={onEnter}
            onBlur={onLeave}
        >
            <span className="relative block h-8 w-8 shrink-0 overflow-hidden rounded-sm sm:h-9 sm:w-9">
                <Image
                    src={LOGO}
                    alt=""
                    fill
                    sizes="36px"
                    className={`object-cover transition-opacity duration-200 ${hovered ? "opacity-0" : "opacity-100"}`}
                    priority
                />
                <video
                    ref={videoRef}
                    src={LOGO_ANIM}
                    muted
                    loop
                    playsInline
                    preload="auto"
                    aria-hidden
                    className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${hovered ? "opacity-100" : "opacity-0"}`}
                />
            </span>
        </Link>
    );
}

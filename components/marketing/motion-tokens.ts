/**
 * Motion tokens for marketing instruments.
 * Heavy settle easings — vault weight, not bounce. Enter decelerates; exit is faster.
 */

export const easeOutHeavy = [0.16, 1, 0.3, 1] as const;
export const easeInExit = [0.4, 0, 1, 1] as const;
export const easeStandard = [0.22, 1, 0.36, 1] as const;

export const duration = {
    micro: 0.16,
    ui: 0.38,
    signature: 0.72,
} as const;

export const settle = {
    duration: duration.signature,
    ease: easeOutHeavy,
} as const;

export const uiIn = {
    duration: duration.ui,
    ease: easeOutHeavy,
} as const;

export const uiOut = {
    duration: duration.ui * 0.7,
    ease: easeInExit,
} as const;

export const micro = {
    duration: duration.micro,
    ease: easeStandard,
} as const;

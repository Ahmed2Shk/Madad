import type { CSSProperties } from 'react';

/** Style for the i-th item of a list using `animate-rise`: each item rises a beat after the previous one. */
export const stagger = (i: number) => ({ '--i': i }) as CSSProperties;

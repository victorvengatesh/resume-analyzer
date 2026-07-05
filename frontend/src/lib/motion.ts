import type { Variants, Transition } from 'framer-motion';

// ─── Shared spring configs ────────────────────────────────────────────────────

export const spring = {
  snappy:  { type: 'spring', stiffness: 400, damping: 28 } as Transition,
  smooth:  { type: 'spring', stiffness: 260, damping: 24 } as Transition,
  gentle:  { type: 'spring', stiffness: 180, damping: 20 } as Transition,
  bouncy:  { type: 'spring', stiffness: 500, damping: 22 } as Transition,
};

// ─── Page-level transitions ───────────────────────────────────────────────────

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { ...spring.smooth, staggerChildren: 0.06 },
  },
  exit: { opacity: 0, y: -8, transition: { duration: 0.18 } },
};

// ─── Fade variants ────────────────────────────────────────────────────────────

export const fadeUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: spring.smooth },
  exit:    { opacity: 0, y: -8 },
};

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.35 } },
  exit:    { opacity: 0, transition: { duration: 0.2 } },
};

export const fadeScale: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: spring.snappy },
  exit:    { opacity: 0, scale: 0.96, transition: { duration: 0.15 } },
};

export const slideRight: Variants = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0, transition: spring.smooth },
  exit:    { opacity: 0, x: -12 },
};

export const slideLeft: Variants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: spring.smooth },
  exit:    { opacity: 0, x: 12 },
};

export const slideDown: Variants = {
  initial: { opacity: 0, y: -12 },
  animate: { opacity: 1, y: 0, transition: spring.snappy },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

// ─── List stagger container ───────────────────────────────────────────────────

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

export const staggerFast: Variants = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.04, delayChildren: 0.02 },
  },
};

// ─── List item (pair with staggerContainer) ───────────────────────────────────

export const listItem: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: spring.smooth },
};

// ─── Modal / overlay ─────────────────────────────────────────────────────────

export const backdropVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit:    { opacity: 0, transition: { duration: 0.18 } },
};

export const modalVariants: Variants = {
  initial: { opacity: 0, scale: 0.93, y: 16 },
  animate: { opacity: 1, scale: 1, y: 0, transition: spring.snappy },
  exit:    { opacity: 0, scale: 0.95, y: 8, transition: { duration: 0.15 } },
};

// ─── Toast notification ───────────────────────────────────────────────────────

export const toastVariants: Variants = {
  initial: { opacity: 0, x: 60, scale: 0.94 },
  animate: { opacity: 1, x: 0, scale: 1, transition: spring.snappy },
  exit:    { opacity: 0, x: 40, scale: 0.96, transition: { duration: 0.2 } },
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export const sidebarVariants: Variants = {
  expanded: { width: 240, transition: spring.smooth },
  collapsed: { width: 64, transition: spring.smooth },
};

// ─── AI pulse (for thinking state) ───────────────────────────────────────────

export const pulseDot: Variants = {
  initial: { scale: 0.6, opacity: 0.3 },
  animate: {
    scale: [0.6, 1.1, 0.6],
    opacity: [0.3, 1, 0.3],
    transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' },
  },
};

export const glowPulse: Variants = {
  initial: { opacity: 0.4 },
  animate: {
    opacity: [0.4, 0.9, 0.4],
    scale:   [1, 1.04, 1],
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
  },
};

// ─── Number counter (use with useSpring from framer-motion) ──────────────────
// Not a Variants object — used as transition config for useSpring
export const counterSpring = { stiffness: 80, damping: 18, mass: 1 };

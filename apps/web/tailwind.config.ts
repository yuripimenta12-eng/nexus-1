import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /* ── Nexus Design System v2 ─────────────────────── */
        background: {
          DEFAULT: '#0d0a16',
          void:     '#07050c',
          deep:     '#09070d',
          base:     '#0d0a16',
          raised:   '#131020',
          elevated: '#1a1629',
          float:    '#221e33',
          overlay:  '#2a263e',
          /* legacy */
          secondary: '#131020',
          tertiary:  '#1a1629',
          hover:     '#221e33',
        },
        surface: {
          DEFAULT: '#1a1629',
          raised:  '#221e33',
          overlay: '#2a263e',
        },
        border: {
          DEFAULT: '#2a1f40',
          subtle:  '#1a1429',
          glow:    'rgba(124,90,240,0.30)',
        },
        /* ── Brand ──────────────────────────────────────── */
        accent: {
          DEFAULT:    '#7c5af0',
          hover:      '#9b6dff',
          deep:       '#5b3fd4',
          dim:        'rgba(124,90,240,0.18)',
          glow:       'rgba(124,90,240,0.35)',
          foreground: '#ffffff',
          /* legacy */
          light: '#9b6dff',
        },
        orange: {
          DEFAULT: '#ff6a00',
          bright:  '#ff8c33',
          dim:     'rgba(255,106,0,0.15)',
          glow:    'rgba(255,106,0,0.28)',
        },
        violet: { DEFAULT: '#b142f5' },
        /* ── Status ─────────────────────────────────────── */
        online:  '#2dd67b',
        away:    '#f59e0b',
        busy:    '#ff4444',
        offline: '#4a4560',
        speaking:'#4ade80',
        /* ── Semantic ───────────────────────────────────── */
        success:     '#2dd67b',
        warning:     '#f59e0b',
        destructive: { DEFAULT: '#ff4444', foreground: '#ffffff' },
        info:        '#38b2f9',
        muted: {
          DEFAULT:    '#7a748e',
          foreground: '#b8b0cc',
        },
        /* ── Accent-blue (legacy) ───────────────────────── */
        'accent-blue': {
          DEFAULT: '#3b82f6',
          hover:   '#2563eb',
        },
        'accent-orange': {
          DEFAULT: '#ff6a00',
          hover:   '#ff8c33',
        },
      },

      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },

      borderRadius: {
        xs:  '4px',
        sm:  '6px',
        md:  '10px',
        lg:  '14px',
        xl:  '18px',
        '2xl': '24px',
        '3xl': '32px',
      },

      boxShadow: {
        'nx-sm':   '0 2px 8px rgba(0,0,0,0.4)',
        'nx-md':   '0 8px 24px rgba(0,0,0,0.5)',
        'nx-lg':   '0 20px 50px rgba(0,0,0,0.6)',
        'nx-xl':   '0 35px 80px rgba(0,0,0,0.7)',
        'nx-glow': '0 0 20px rgba(124,90,240,0.35)',
        'nx-glow-orange': '0 0 20px rgba(255,106,0,0.28)',
        'nx-inset': 'inset 0 1px 0 rgba(255,255,255,0.06)',
      },

      backgroundImage: {
        'nx-gradient-brand':  'linear-gradient(135deg,#ff6a00 0%,#7c5af0 50%,#b142f5 100%)',
        'nx-gradient-purple': 'linear-gradient(135deg,#7c5af0,#b142f5)',
        'nx-gradient-orange': 'linear-gradient(135deg,#ff6a00,#ff8c33)',
        'nx-gradient-text':   'linear-gradient(90deg,#ff6a00,#ff8c33 30%,#7c5af0 65%,#b142f5)',
        'nx-glass':           'linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))',
        'nx-radial-purple':   'radial-gradient(circle,rgba(124,90,240,0.15) 0%,transparent 70%)',
        'nx-radial-orange':   'radial-gradient(circle,rgba(255,106,0,0.12) 0%,transparent 70%)',
      },

      animation: {
        /* ── Existing ─── */
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'speaking':   'nx-speaking 1.2s ease-in-out infinite',
        'slide-in':   'nx-slide-in-right 0.2s ease-out',
        'fade-in':    'nx-fade-in 0.15s ease-out',
        /* ── New ───────── */
        'nx-speaking-ring': 'nx-speaking-ring 1.4s ease-in-out infinite',
        'nx-pulse-dot':     'nx-pulse-dot 1.8s infinite',
        'nx-glow-pulse':    'nx-glow-pulse 2.5s ease-in-out infinite',
        'nx-slide-up':      'nx-slide-in-up 0.25s ease-out',
        'nx-scale-in':      'nx-scale-in 0.2s ease-out',
        'nx-shimmer':       'nx-shimmer 2s infinite linear',
        'nx-orbit':         'nx-orbit 18s linear infinite',
        'nx-float':         'nx-float 4s ease-in-out infinite',
        'spin-slow':        'spin 3s linear infinite',
      },

      keyframes: {
        'nx-speaking': {
          '0%,100%': { transform: 'scale(1)',    boxShadow: '0 0 0 0 rgba(45,214,123,0.4)' },
          '50%':      { transform: 'scale(1.02)',boxShadow: '0 0 0 8px rgba(45,214,123,0)' },
        },
        'nx-speaking-ring': {
          '0%':   { boxShadow: '0 0 0 0 rgba(45,214,123,0.5)' },
          '70%':  { boxShadow: '0 0 0 10px rgba(45,214,123,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(45,214,123,0)' },
        },
        'nx-pulse-dot': {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(45,214,123,0.6)' },
          '50%':     { boxShadow: '0 0 0 6px rgba(45,214,123,0)' },
        },
        'nx-glow-pulse': {
          '0%,100%': { opacity: '0.6' },
          '50%':     { opacity: '1' },
        },
        'nx-slide-in-right': {
          from: { transform: 'translateX(-10px)', opacity: '0' },
          to:   { transform: 'translateX(0)',     opacity: '1' },
        },
        'nx-slide-in-up': {
          from: { transform: 'translateY(8px)', opacity: '0' },
          to:   { transform: 'translateY(0)',   opacity: '1' },
        },
        'nx-fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'nx-scale-in': {
          from: { transform: 'scale(0.95)', opacity: '0' },
          to:   { transform: 'scale(1)',    opacity: '1' },
        },
        'nx-shimmer': {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        'nx-orbit': {
          from: { transform: 'rotate(0deg)' },
          to:   { transform: 'rotate(360deg)' },
        },
        'nx-float': {
          '0%,100%': { transform: 'translateY(0)' },
          '50%':     { transform: 'translateY(-6px)' },
        },
        /* legacy */
        speaking: {
          '0%,100%': { transform: 'scale(1)',    boxShadow: '0 0 0 0 rgba(124,90,240,0.4)' },
          '50%':     { transform: 'scale(1.02)', boxShadow: '0 0 0 6px rgba(124,90,240,0)' },
        },
        slideIn: {
          from: { transform: 'translateX(-10px)', opacity: '0' },
          to:   { transform: 'translateX(0)',     opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
      },

      transitionDuration: {
        fast:   '120ms',
        normal: '200ms',
        slow:   '350ms',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;

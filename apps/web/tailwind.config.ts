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
        // ── Design Tokens Nexus ──────────────────────────────────
        background: {
          DEFAULT: '#0f0f14',
          secondary: '#17171f',
          tertiary: '#1e1e2a',
          hover: '#252534',
        },
        surface: {
          DEFAULT: '#1e1e2a',
          raised: '#252534',
          overlay: '#2d2d3e',
        },
        border: {
          DEFAULT: '#2d2d3e',
          subtle: '#1e1e2a',
        },
        accent: {
          DEFAULT: '#7c5af0',
          hover: '#6b47e0',
          light: '#a785f5',
          foreground: '#ffffff',
        },
        'accent-blue': {
          DEFAULT: '#3b82f6',
          hover: '#2563eb',
        },
        'accent-orange': {
          DEFAULT: '#f97316',
          hover: '#ea6c0d',
        },
        muted: {
          DEFAULT: '#8b8ba7',
          foreground: '#b8b8d0',
        },
        success: '#22c55e',
        warning: '#f59e0b',
        destructive: {
          DEFAULT: '#ef4444',
          foreground: '#ffffff',
        },
        online: '#22c55e',
        away: '#f59e0b',
        busy: '#ef4444',
        offline: '#6b7280',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        lg: '12px',
        md: '8px',
        sm: '6px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'speaking': 'speaking 1.2s ease-in-out infinite',
        'slide-in': 'slideIn 0.2s ease-out',
        'fade-in': 'fadeIn 0.15s ease-out',
      },
      keyframes: {
        speaking: {
          '0%, 100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(124, 90, 240, 0.4)' },
          '50%': { transform: 'scale(1.02)', boxShadow: '0 0 0 6px rgba(124, 90, 240, 0)' },
        },
        slideIn: {
          from: { transform: 'translateX(-10px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;

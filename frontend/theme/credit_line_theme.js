/**
 * Credit Line — Phase 19: Rebranded Design System Configuration.
 * 
 * Establishes the new brand identity with SF Pro typography,
 * "Credit Line Obsidian" (#0A0A0C) for dark mode surface foundations,
 * and "Yield Green" (#00E676) for success indicators and checkout CTAs.
 */

module.exports = {
  theme: {
    extend: {
      fontFamily: {
        display: ['"SF Pro Display"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        sans: ['"SF Pro Text"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"SF Mono"', 'Menlo', 'Monaco', '"Cascadia Code"', 'monospace'],
      },
      colors: {
        // Core Obsidian Foundation
        'credit-line-obsidian': '#0A0A0C',
        // Yield Green Brand Accent
        'yield-green': '#00E676',
        'yield-green-hover': '#00C853',
        
        // Multi-tenant color palettes
        'credit-line': {
          50: '#F5F5F7',
          100: '#E8E8ED',
          200: '#D1D1D6',
          300: '#AEAEB2',
          400: '#8E8E93',
          500: '#00E676', // Primary Yield Green
          600: '#00C853',
          700: '#009624',
          800: '#1C1C1E',
          900: '#0A0A0C', // Core Obsidian Dark
        },
        risk: {
          low: '#00E676',      // Low risk uses Yield Green
          medium: '#FF9F0A',
          high: '#FF3B30',
          critical: '#FF2D55',
        }
      },
      boxShadow: {
        'yield-glow': '0 0 16px rgba(0, 230, 118, 0.28), 0 0 1px 1px rgba(0, 230, 118, 0.15)',
        'obsidian-glass': '0 8px 32px 0 rgba(0, 0, 0, 0.7)',
      }
    }
  }
};

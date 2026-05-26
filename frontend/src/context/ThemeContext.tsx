import React, { createContext, useContext, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

interface ThemeContextProps {
  theme: 'light' | 'dark' | 'high-contrast';
  setTheme: (theme: 'light' | 'dark' | 'high-contrast') => void;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useAppStore();

  useEffect(() => {
    const root = document.documentElement;
    
    // Remove old theme classes
    root.classList.remove('dark', 'light', 'theme-high-contrast');

    // Apply the correct theme class
    if (theme === 'dark') {
      root.classList.add('dark');
      // Set exact Phase 12 colors for Dark Mode
      root.style.setProperty('--bg-primary', '#000000');
      root.style.setProperty('--bg-secondary', '#1C1C1E');
      root.style.setProperty('--text-primary', '#F5F5F7');
      root.style.setProperty('--border-primary', '#2C2C2E');
      root.style.setProperty('--border-secondary', '#1C1C1E');
      root.style.setProperty('--bg-card', '#1C1C1E');
      root.style.setProperty('--bg-overlay', 'rgba(0, 0, 0, 0.92)');
    } else if (theme === 'high-contrast') {
      root.classList.add('theme-high-contrast');
      root.classList.add('dark');
      root.style.setProperty('--bg-primary', '#000000');
      root.style.setProperty('--bg-secondary', '#000000');
      root.style.setProperty('--text-primary', '#FFFFFF');
      root.style.setProperty('--border-primary', '#FFFFFF');
      root.style.setProperty('--border-secondary', '#FFFFFF');
    } else {
      root.classList.add('light');
      // Set exact Phase 12 colors for Light Mode
      root.style.setProperty('--bg-primary', '#FFFFFF');
      root.style.setProperty('--bg-secondary', '#F5F5F7');
      root.style.setProperty('--text-primary', '#1D1D1F');
      root.style.setProperty('--border-primary', '#E5E5EA');
      root.style.setProperty('--border-secondary', '#F5F5F7');
      root.style.setProperty('--bg-card', '#FFFFFF');
      root.style.setProperty('--bg-overlay', 'rgba(255, 255, 255, 0.94)');
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

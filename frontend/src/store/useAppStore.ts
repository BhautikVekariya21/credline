import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  theme: 'dark' | 'light' | 'high-contrast';
  font: 'satoshi' | 'system' | 'mono';
  shadowMode: boolean;
  sidebarOpen: boolean;
  activeSection: string;
  notificationThreshold: number;
  emailNotifications: boolean;
  slackNotifications: boolean;
  soarEscalations: boolean;
  apiKey: string;
  region: string;
  setTheme: (theme: 'dark' | 'light' | 'high-contrast') => void;
  setFont: (font: 'satoshi' | 'system' | 'mono') => void;
  toggleShadowMode: () => void;
  setShadowMode: (mode: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setActiveSection: (section: string) => void;
  setNotificationThreshold: (threshold: number) => void;
  setEmailNotifications: (val: boolean) => void;
  setSlackNotifications: (val: boolean) => void;
  setSoarEscalations: (val: boolean) => void;
  setApiKey: (key: string) => void;
  setRegion: (region: string) => void;
  resetToDefaults: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'dark',
      font: 'satoshi',
      shadowMode: false,
      sidebarOpen: true,
      activeSection: 'overview',
      notificationThreshold: 80,
      emailNotifications: true,
      slackNotifications: false,
      soarEscalations: true,
      apiKey: 'efs_live_7a4f3b2c9d1e8f5a6b0c_2026',
      region: 'ap-south-1',
      setTheme: (theme) => set({ theme }),
      setFont: (font) => set({ font }),
      toggleShadowMode: () => set((state) => ({ shadowMode: !state.shadowMode })),
      setShadowMode: (mode) => set({ shadowMode: mode }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setActiveSection: (section) => set({ activeSection: section }),
      setNotificationThreshold: (threshold) => set({ notificationThreshold: threshold }),
      setEmailNotifications: (val) => set({ emailNotifications: val }),
      setSlackNotifications: (val) => set({ slackNotifications: val }),
      setSoarEscalations: (val) => set({ soarEscalations: val }),
      setApiKey: (apiKey) => set({ apiKey }),
      setRegion: (region) => set({ region }),
      resetToDefaults: () => set({
        theme: 'dark',
        font: 'satoshi',
        shadowMode: false,
        sidebarOpen: true,
        activeSection: 'overview',
        notificationThreshold: 80,
        emailNotifications: true,
        slackNotifications: false,
        soarEscalations: true,
        apiKey: 'efs_live_7a4f3b2c9d1e8f5a6b0c_2026',
        region: 'ap-south-1',
      }),
    }),
    {
      name: 'credline-store',
    }
  )
);

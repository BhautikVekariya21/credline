import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AppNotification {
  id: string;
  type: 'fraud' | 'credit' | 'system' | 'compliance' | 'model';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  pinned: boolean;
  source?: string;
}

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
  notifications: AppNotification[];
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
  addNotification: (n: Omit<AppNotification, 'id' | 'timestamp' | 'read' | 'pinned'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  togglePin: (id: string) => void;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;
  resetToDefaults: () => void;
}

let _notifCounter = 0;

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
      notifications: [],
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
      addNotification: (n) => set((state) => ({
        notifications: [
          {
            ...n,
            id: `NOTIF-${Date.now()}-${++_notifCounter}`,
            timestamp: new Date().toISOString(),
            read: false,
            pinned: false,
          },
          ...state.notifications,
        ].slice(0, 200),
      })),
      markAsRead: (id) => set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
      })),
      markAllAsRead: () => set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
      })),
      togglePin: (id) => set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, pinned: !n.pinned } : n
        ),
      })),
      dismissNotification: (id) => set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      })),
      clearNotifications: () => set({ notifications: [] }),
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
        notifications: [],
      }),
    }),
    {
      name: 'credline-store',
    }
  )
);

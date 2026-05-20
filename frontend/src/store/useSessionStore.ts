import { create } from 'zustand';

interface SessionState {
  isLocked: boolean;
  lastActive: number;
  lockSession: () => void;
  unlockSession: (pin: string) => boolean;
  updateActivity: () => void;
}

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const VALID_PIN = '1234'; // In a real app, this would validate against a backend

export const useSessionStore = create<SessionState>((set, get) => ({
  isLocked: false,
  lastActive: Date.now(),
  
  lockSession: () => set({ isLocked: true }),
  
  unlockSession: (pin: string) => {
    if (pin === VALID_PIN) {
      set({ isLocked: false, lastActive: Date.now() });
      return true;
    }
    return false;
  },
  
  updateActivity: () => {
    const state = get();
    if (state.isLocked) return;
    
    const now = Date.now();
    if (now - state.lastActive > IDLE_TIMEOUT_MS) {
      set({ isLocked: true, lastActive: now });
    } else {
      set({ lastActive: now });
    }
  },
}));

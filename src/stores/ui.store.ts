import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { STORAGE_KEYS } from '@/constants/storage-keys';

interface UiState {
  /** Sidebar recolhida no desktop (persistido). */
  sidebarCollapsed: boolean;
  /** Navegação aberta em telas pequenas (não persistido). */
  mobileNavOpen: boolean;
  toggleSidebar: () => void;
  setMobileNavOpen: (open: boolean) => void;
}

/** Estado global exclusivamente de interface. Dados de negócio ficam no TanStack Query. */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileNavOpen: false,
      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },
      setMobileNavOpen: (open) => {
        set({ mobileNavOpen: open });
      },
    }),
    {
      name: STORAGE_KEYS.ui,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
    },
  ),
);

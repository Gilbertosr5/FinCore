import { createContext, useContext } from 'react';

export interface DemoDataInfo {
  referenceDate: string;
  createdAt: string;
}

/** Gestão do ambiente de demonstração (somente com VITE_DATA_SOURCE=mock). */
export interface DemoDataManager {
  getInfo(): Promise<DemoDataInfo | null>;
  reset(): Promise<DemoDataInfo>;
}

export const DemoDataContext = createContext<DemoDataManager | null>(null);

/** `null` quando a aplicação usa a API real. */
export function useDemoDataManager(): DemoDataManager | null {
  return useContext(DemoDataContext);
}

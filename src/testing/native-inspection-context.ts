import { createContext } from 'react';

export const NativeInspectionContext = createContext<
  (() => Promise<string>) | null
>(null);

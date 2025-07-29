'use client';

import React, { createContext, useContext, useState } from 'react';

interface LayoutContextType {
  headerAction: React.ReactNode | null;
  setHeaderAction: (action: React.ReactNode | null) => void;
  headerTitle: string | undefined;
  setHeaderTitle: (title: string | undefined) => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [headerAction, setHeaderAction] = useState<React.ReactNode | null>(null);
  const [headerTitle, setHeaderTitle] = useState<string | undefined>(undefined);

  return (
    <LayoutContext.Provider value={{ headerAction, setHeaderAction, headerTitle, setHeaderTitle }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (context === undefined) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
} 
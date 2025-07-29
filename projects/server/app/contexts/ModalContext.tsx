'use client';

import React, { createContext, useContext, useState } from 'react';

interface ModalContextType {
  modalContent: React.ReactNode | null;
  setModalContent: (content: React.ReactNode | null) => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modalContent, setModalContent] = useState<React.ReactNode | null>(null);

  return (
    <ModalContext.Provider value={{ modalContent, setModalContent }}>
      {children}
      {modalContent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          {modalContent}
        </div>
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
} 
import React from 'react';
import { render, RenderOptions } from '@testing-library/react';

// Mock the Next.js router
const mockRouter = {
  back: jest.fn(),
  forward: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
  refresh: jest.fn(),
  prefetch: jest.fn(),
};

// Mock the useRouter hook
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Custom render function that includes necessary providers
const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  return render(ui, { ...options });
};

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };
export { mockRouter }; 
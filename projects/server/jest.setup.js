require('@testing-library/jest-dom');

// Add Node.js globals for test environment
global.setImmediate = global.setImmediate || ((fn, ...args) => setTimeout(fn, 0, ...args));

// Mock Next.js navigation hooks
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    back: jest.fn(),
    forward: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
})); 
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

(globalThis as any).React = React;

Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
  writable: true,
});

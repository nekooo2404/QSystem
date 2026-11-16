import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { clearApiCache } from '../src/lib/api/cache';

afterEach(() => {
  cleanup();
  clearApiCache();
  window.localStorage.clear();
  localStorage.clear();
});

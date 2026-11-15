import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { toast } from '../src/toast';

afterEach(() => {
  cleanup();
  // Reset the module-level toast store so tests stay isolated.
  toast.dismiss();
});

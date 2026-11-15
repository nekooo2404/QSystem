'use client';

// @qsystem/ui/ToastRegion uses hooks but ships no "use client" directive, so
// the server layout needs this thin client boundary.
export { ToastRegion } from '@qsystem/ui';

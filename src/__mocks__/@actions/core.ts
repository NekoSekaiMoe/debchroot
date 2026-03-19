import { vi } from 'vitest';

export const getInput = vi.fn();
export const setOutput = vi.fn();
export const setFailed = vi.fn();
export const info = vi.fn();
export const warning = vi.fn();
export const error = vi.fn();
export const startGroup = vi.fn();
export const endGroup = vi.fn();

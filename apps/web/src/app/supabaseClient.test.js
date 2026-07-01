import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClient = vi.fn(() => ({ auth: {}, from: vi.fn() }));

vi.mock('@supabase/supabase-js', () => ({
  createClient,
}));

describe('supabase client', () => {
  beforeEach(() => {
    createClient.mockClear();
    vi.resetModules();
  });

  it('creates a single shared client instance', async () => {
    const first = await import('./supabaseClient');
    const second = await import('./supabaseClient');

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(first.supabase).toBe(second.supabase);
  });
});

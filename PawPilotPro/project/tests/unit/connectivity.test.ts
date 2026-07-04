// Connectivity monitor: online/offline events + ping fallback behaviour.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type Handler = () => void;

interface FakeEnv {
  nav: { onLine: boolean };
  fire: (type: string) => void;
}

function setupGlobals(onLine: boolean): FakeEnv {
  const winHandlers: Record<string, Handler[]> = {};
  const nav = { onLine };
  vi.stubGlobal('navigator', nav);
  vi.stubGlobal('window', {
    addEventListener: (t: string, cb: Handler) => {
      (winHandlers[t] ||= []).push(cb);
    },
    setInterval: () => 0,
  });
  vi.stubGlobal('document', {
    addEventListener: () => {},
    visibilityState: 'visible',
  });
  return { nav, fire: t => winHandlers[t]?.forEach(cb => cb()) };
}

function stubFetch(ok: boolean) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => (ok ? Promise.resolve({ ok: true }) : Promise.reject(new TypeError('network down')))),
  );
}

async function importFresh() {
  vi.resetModules();
  return import('../../src/app/hooks/useConnectivity');
}

describe('connectivity monitor', () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it('goes offline immediately on the offline event, without waiting for a ping', async () => {
    const env = setupGlobals(true);
    stubFetch(true);
    const mod = await importFresh();
    mod.initConnectivityMonitor();
    await vi.waitFor(() => expect(mod.useConnectivityStore.getState().isOnline).toBe(true));

    env.nav.onLine = false;
    env.fire('offline');
    expect(mod.useConnectivityStore.getState().isOnline).toBe(false);
  });

  it('treats navigator.onLine=true with a failing ping as offline (router up, internet down)', async () => {
    const env = setupGlobals(true);
    stubFetch(false);
    const mod = await importFresh();
    mod.initConnectivityMonitor();
    await vi.waitFor(() => expect(mod.useConnectivityStore.getState().isOnline).toBe(false));
    expect(env.nav.onLine).toBe(true); // onLine still lies; the ping caught it
  });

  it('recovers via the online event once the ping succeeds, no manual refresh needed', async () => {
    const env = setupGlobals(false);
    stubFetch(true);
    const mod = await importFresh();
    mod.initConnectivityMonitor();
    await vi.waitFor(() => expect(mod.useConnectivityStore.getState().isOnline).toBe(false));

    env.nav.onLine = true;
    env.fire('online');
    await vi.waitFor(() => expect(mod.useConnectivityStore.getState().isOnline).toBe(true));
  });

  it('an in-flight ping result cannot overwrite a newer offline event', async () => {
    const env = setupGlobals(true);
    // Ping that resolves ok, but only after we let the offline event land.
    let release!: (v: { ok: boolean }) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise(res => (release = res))));
    const mod = await importFresh();
    mod.initConnectivityMonitor(); // kicks off initial verify(), ping now pending

    env.nav.onLine = false;
    env.fire('offline');
    expect(mod.useConnectivityStore.getState().isOnline).toBe(false);

    release({ ok: true }); // stale ping resolves "online"
    await new Promise(r => setTimeout(r, 0));
    expect(mod.useConnectivityStore.getState().isOnline).toBe(false);
  });
});

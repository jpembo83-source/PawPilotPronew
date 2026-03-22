import { supabase } from '../../utils/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type RealtimeModule =
  | 'daycare'
  | 'grooming'
  | 'transport'
  | 'overnights'
  | 'customers'
  | 'staff'
  | 'billing'
  | 'settings'
  | 'incidents';

export interface RealtimeEvent {
  module: RealtimeModule;
  entity: string;
  action: 'created' | 'updated' | 'deleted';
  recordId?: string;
  locationId?: string;
  userId: string;
  clientId: string;
  timestamp: number;
  meta?: Record<string, unknown>;
}

type EventCallback = (event: RealtimeEvent) => void;

const CLIENT_ID = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

class RealtimeManager {
  private channels: Map<string, RealtimeChannel> = new Map();
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private tenantId: string | null = null;
  private connected = false;
  private pendingModules: Set<RealtimeModule> = new Set();

  get clientId() {
    return CLIENT_ID;
  }

  init(tenantId: string) {
    if (this.tenantId === tenantId && this.connected) return;

    const previousTenantId = this.tenantId;
    this.tenantId = tenantId;
    this.connected = true;

    if (previousTenantId && previousTenantId !== tenantId) {
      this.rebindAllChannels();
    }

    if (this.pendingModules.size > 0) {
      for (const mod of this.pendingModules) {
        this.ensureChannel(mod);
      }
      this.pendingModules.clear();
    }
  }

  private rebindAllChannels() {
    const activeModules = new Set<RealtimeModule>();
    for (const [channelName, channel] of this.channels) {
      const parts = channelName.split(':');
      const mod = parts[2] as RealtimeModule;
      if (mod) activeModules.add(mod);
      supabase.removeChannel(channel);
    }
    this.channels.clear();

    for (const mod of activeModules) {
      this.ensureChannel(mod);
    }
  }

  private getChannelName(module: RealtimeModule): string {
    return `sync:${this.tenantId || 'default'}:${module}`;
  }

  private ensureChannel(module: RealtimeModule): RealtimeChannel | null {
    if (!this.connected || !this.tenantId) {
      this.pendingModules.add(module);
      return null;
    }

    const channelName = this.getChannelName(module);

    if (this.channels.has(channelName)) {
      return this.channels.get(channelName)!;
    }

    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'sync' }, (payload) => {
        const event = payload.payload as RealtimeEvent;
        if (event.clientId === CLIENT_ID) return;
        this.notifyListeners(module, event);
      })
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  private notifyListeners(module: RealtimeModule, event: RealtimeEvent) {
    const callbacks = this.listeners.get(module);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(event);
        } catch (err) {
          console.error(`[Realtime] Listener error for ${module}:`, err);
        }
      });
    }
  }

  broadcast(event: Omit<RealtimeEvent, 'clientId' | 'timestamp'>) {
    if (!this.connected || !this.tenantId) return;

    const fullEvent: RealtimeEvent = {
      ...event,
      clientId: CLIENT_ID,
      timestamp: Date.now(),
    };

    const channel = this.ensureChannel(event.module);
    if (!channel) return;

    channel.send({
      type: 'broadcast',
      event: 'sync',
      payload: fullEvent,
    });
  }

  subscribe(module: RealtimeModule, callback: EventCallback): () => void {
    this.ensureChannel(module);

    if (!this.listeners.has(module)) {
      this.listeners.set(module, new Set());
    }
    this.listeners.get(module)!.add(callback);

    return () => {
      const callbacks = this.listeners.get(module);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.listeners.delete(module);
          const channelName = this.getChannelName(module);
          const channel = this.channels.get(channelName);
          if (channel) {
            supabase.removeChannel(channel);
            this.channels.delete(channelName);
          }
        }
      }
    };
  }

  disconnect() {
    this.channels.forEach((channel) => {
      supabase.removeChannel(channel);
    });
    this.channels.clear();
    this.listeners.clear();
    this.pendingModules.clear();
    this.connected = false;
    this.tenantId = null;
  }
}

export const realtimeManager = new RealtimeManager();

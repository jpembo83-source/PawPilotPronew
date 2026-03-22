import React from 'react';
import { toast } from 'sonner';
import type { RealtimeEvent } from '../lib/realtime';

const MODULE_LABELS: Record<string, string> = {
  daycare: 'Daycare',
  grooming: 'Grooming',
  transport: 'Transport',
  overnights: 'Overnights',
  customers: 'Customer',
  staff: 'Staff',
  billing: 'Billing',
  incidents: 'Incident',
  settings: 'Settings',
};

const ACTION_LABELS: Record<string, string> = {
  created: 'added',
  updated: 'updated',
  deleted: 'removed',
};

let activeEdits: Map<string, { module: string; entity: string; recordId: string }> = new Map();

export function registerActiveEdit(module: string, entity: string, recordId: string) {
  const key = `${module}:${entity}:${recordId}`;
  activeEdits.set(key, { module, entity, recordId });
  return () => {
    activeEdits.delete(key);
  };
}

export function clearActiveEdit(module: string, entity: string, recordId: string) {
  activeEdits.delete(`${module}:${entity}:${recordId}`);
}

export function notifyRealtimeUpdate(event: RealtimeEvent) {
  const module = MODULE_LABELS[event.module] || event.module;
  const action = ACTION_LABELS[event.action] || event.action;
  const entity = event.entity || 'record';

  if (event.recordId && event.action === 'updated') {
    const editKey = `${event.module}:${event.entity}:${event.recordId}`;
    if (activeEdits.has(editKey)) {
      toast.warning(`Conflict: ${module} ${entity} was ${action} by another user`, {
        description: 'Your changes may overwrite theirs. Please refresh before saving.',
        duration: 8000,
        id: `conflict-${editKey}`,
      });
      return;
    }
  }

  toast.info(`${module} ${entity} ${action}`, {
    description: 'Data refreshed automatically.',
    duration: 3000,
    id: `rt-${event.module}-${event.recordId || event.timestamp}`,
  });
}

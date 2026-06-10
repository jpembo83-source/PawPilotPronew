import React from 'react';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Switch } from '../../../components/ui/switch';
import { Button } from '../../../components/ui/button';
import { X } from '@phosphor-icons/react';
import { useMessagingStore } from '../store';
import { useSettingsStore } from '../../settings/store';

export function InboxFilters() {
  const { filters, setFilters, clearFilters } = useMessagingStore();
  const { locations, globalEnabledModules } = useSettingsStore();

  const hasFilters = Object.keys(filters).length > 0;

  return (
    <div className="space-y-3 p-3 border rounded-lg bg-slate-50">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Filters</h4>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-6 px-2 text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Location filter */}
      <div className="space-y-1.5">
        <Label className="text-xs">Location</Label>
        <Select
          value={filters.locationId || 'ALL'}
          onValueChange={(value) => setFilters({ locationId: value === 'ALL' ? undefined : value })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="All locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All locations</SelectItem>
            {locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Module filter */}
      <div className="space-y-1.5">
        <Label className="text-xs">Module</Label>
        <Select
          value={filters.module || 'ALL'}
          onValueChange={(value) => setFilters({ module: value === 'ALL' ? undefined : value })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="All modules" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All modules</SelectItem>
            {globalEnabledModules.map((module) => (
              <SelectItem key={module} value={module}>
                {module.charAt(0).toUpperCase() + module.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Channel filter */}
      <div className="space-y-1.5">
        <Label className="text-xs">Channel</Label>
        <Select
          value={filters.channel || 'ALL'}
          onValueChange={(value) => setFilters({ channel: value === 'ALL' ? undefined : value as any })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="All channels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All channels</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Toggle filters */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="unread-only" className="text-xs">Unread only</Label>
          <Switch
            id="unread-only"
            checked={filters.unreadOnly || false}
            onCheckedChange={(checked) => setFilters({ unreadOnly: checked || undefined })}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="awaiting-response" className="text-xs">Awaiting response</Label>
          <Switch
            id="awaiting-response"
            checked={filters.awaitingResponseOnly || false}
            onCheckedChange={(checked) => setFilters({ awaitingResponseOnly: checked || undefined })}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="sla-breached" className="text-xs">SLA breached</Label>
          <Switch
            id="sla-breached"
            checked={filters.slaBreachedOnly || false}
            onCheckedChange={(checked) => setFilters({ slaBreachedOnly: checked || undefined })}
          />
        </div>
      </div>
    </div>
  );
}

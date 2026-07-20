import React from 'react';
import { useNavigate } from 'react-router';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../ui/sheet';
import {
  Bell,
  CalendarPlus,
  Syringe,
  Warning,
  ChatCircleText,
  CircleNotch,
} from '@phosphor-icons/react';
import type { StaffNotification } from '../../hooks/useNotifications';

const TYPE_ICONS: Record<StaffNotification['type'], React.ElementType> = {
  booking_request: CalendarPlus,
  vaccination: Syringe,
  incident: Warning,
  message: ChatCircleText,
};

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

interface NotificationsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: StaffNotification[];
  isLoading: boolean;
}

/** The panel behind the header bell: server-derived work items, each linking
 *  straight to the screen where it gets handled. */
export function NotificationsSheet({ open, onOpenChange, items, isLoading }: NotificationsSheetProps) {
  const navigate = useNavigate();

  const handleOpen = (item: StaffNotification) => {
    onOpenChange(false);
    void navigate(item.href);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-4 py-4 border-b border-slate-200 text-left">
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>
            Things waiting on you — requests, reviews, incidents, and messages.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading && items.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <CircleNotch className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <Bell className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-700">You're all caught up</p>
              <p className="text-sm text-slate-500 mt-1">
                Nothing is waiting for review right now.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((item) => {
                const Icon = TYPE_ICONS[item.type] ?? Bell;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => handleOpen(item)}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors touch-target"
                    >
                      <span className="mt-0.5 p-2 rounded-lg bg-slate-100 text-slate-600 shrink-0">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-slate-900">
                          {item.title}
                        </span>
                        <span className="block text-sm text-slate-500 truncate">
                          {item.body}
                        </span>
                        {item.created_at && (
                          <span className="block text-sm text-slate-400 mt-0.5">
                            {timeAgo(item.created_at)}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

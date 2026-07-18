/**
 * Staff notification sheet — opened from the header bell.
 *
 * Phase 1: a work-queue aggregator, not an event feed. Each row is a pending
 * queue (portal booking requests, pet verifications, vax reviews, photo
 * review, unread messages) with its live count and a deep link into the
 * module that clears it. Rows with nothing pending are hidden; with nothing
 * pending anywhere the sheet says so instead of implying unseen work.
 */

import { Link } from 'react-router';
import {
  Tray,
  PawPrint,
  Syringe,
  Camera,
  ChatCircleDots,
  CaretRight,
  CheckCircle,
  type Icon,
} from '@phosphor-icons/react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../ui/sheet';
import { formatBadgeCount } from '../../hooks/useInboxCounts';
import type { NotificationItem } from '../../lib/notificationItems';

const ITEM_ICONS: Record<NotificationItem['key'], Icon> = {
  booking_requests: Tray,
  pet_verifications: PawPrint,
  vax_reviews: Syringe,
  photo_review: Camera,
  messages: ChatCircleDots,
};

export function NotificationsSheet({
  open,
  onOpenChange,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: NotificationItem[];
}) {
  const pending = items.filter((item) => item.count > 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[320px] sm:w-[380px] p-0 flex flex-col">
        <SheetHeader className="px-4 pt-5 pb-3 text-left">
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>Work waiting on you across the platform.</SheetDescription>
        </SheetHeader>

        {pending.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 px-6 pb-12">
            <CheckCircle className="h-8 w-8 text-muted-foreground" weight="light" />
            <p className="text-sm text-muted-foreground">All caught up — nothing needs you.</p>
          </div>
        ) : (
          <nav className="flex-1 overflow-y-auto px-2 pb-4" aria-label="Pending work">
            {pending.map((item) => {
              const ItemIcon = ITEM_ICONS[item.key];
              return (
                <Link
                  key={item.key}
                  to={item.to}
                  onClick={() => onOpenChange(false)}
                  className="flex items-center gap-3 rounded-lg px-3 hover:bg-accent transition-colors"
                  style={{ minHeight: 56 }}
                >
                  <ItemIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 text-sm font-medium">{item.label}</span>
                  <span
                    className="text-sm font-semibold tabular-nums rounded-full px-2 py-0.5 text-white"
                    style={{ background: 'var(--primary)' }}
                  >
                    {formatBadgeCount(item.count)}
                  </span>
                  <CaretRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              );
            })}
          </nav>
        )}
      </SheetContent>
    </Sheet>
  );
}

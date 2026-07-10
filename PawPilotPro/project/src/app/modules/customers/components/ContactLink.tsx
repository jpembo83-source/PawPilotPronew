import { cn } from '../../../components/ui/utils';
import { useSettingsStore } from '../../settings/store';
import { phoneHref } from './contactHref';

interface ContactLinkProps {
  kind: 'phone' | 'email';
  value?: string | null;
  /** Who the action targets, e.g. "Sarah Smith" — read out as "Call Sarah Smith". */
  contactName?: string;
  className?: string;
}

/**
 * Renders a phone number as tel: / an email as mailto:, visually matching the
 * plain text it replaces (colour inherited, underline only on hover). No
 * click/contextmenu interception beyond stopPropagation, so native long-press
 * and right-click copy keep working.
 */
export function ContactLink({ kind, value, contactName, className }: ContactLinkProps) {
  const dialCode = useSettingsStore((state) => state.organisation.dialCode);

  if (!value) return null;

  const href = kind === 'phone' ? `tel:${phoneHref(value, dialCode)}` : `mailto:${value}`;

  return (
    <a
      href={href}
      aria-label={`${kind === 'phone' ? 'Call' : 'Email'} ${contactName || value}`}
      // Contact info can sit inside clickable rows (customers table); a tap
      // on the link must not also trigger the row's navigation.
      onClick={(event) => event.stopPropagation()}
      className={cn(
        'text-inherit no-underline hover:underline underline-offset-2',
        // ≥44px tap target without shifting layout: pad, then pull back.
        'py-3 -my-3',
        className,
      )}
    >
      {value}
    </a>
  );
}

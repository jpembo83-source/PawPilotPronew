// Non-blocking duplicate nudges for the contact/household create flows.
//
// These render an inline amber notice when the email/phone (or household
// name) being entered already exists on file, with a deep link to the
// matching household and a "Create anyway" dismiss. They NEVER block
// submission — families share phones and staff judgment wins — and the
// lookup fails silent, so a broken duplicate check can't break creation.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Warning } from '@phosphor-icons/react';
import { Button } from '../../../../components/ui/button';
import {
  lookupDuplicates,
  normaliseEmail,
  normalisePhone,
  type DuplicateLookupParams,
  type DuplicateLookupResult,
} from '../../duplicateLookup';

// ≥400ms so typing never hammers the endpoint per keystroke.
const LOOKUP_DEBOUNCE_MS = 450;

const EMPTY_RESULT: DuplicateLookupResult = { contacts: [], households: [] };

/**
 * Debounced, abortable lookup. Values below the "worth asking" thresholds
 * (email without @, phone under 7 digits, name under 3 chars) clear the
 * result instead of querying.
 */
function useDuplicateLookup(params: DuplicateLookupParams): DuplicateLookupResult {
  const [result, setResult] = useState<DuplicateLookupResult>(EMPTY_RESULT);

  const email = normaliseEmail(params.email ?? '');
  const phone = normalisePhone(params.phone ?? '');
  const name = (params.name ?? '').trim();

  const queryEmail = email.includes('@') ? email : '';
  const queryPhone = phone.length >= 7 ? phone : '';
  const queryName = name.length >= 3 ? name : '';

  useEffect(() => {
    if (!queryEmail && !queryPhone && !queryName) {
      setResult(EMPTY_RESULT);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      void lookupDuplicates(
        { email: queryEmail, phone: queryPhone, name: queryName },
        controller.signal,
      ).then(res => {
        if (!controller.signal.aborted) {
          setResult(res ?? EMPTY_RESULT);
        }
      });
    }, LOOKUP_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [queryEmail, queryPhone, queryName]);

  return result;
}

interface NoticeRowProps {
  message: React.ReactNode;
  householdId: string;
  householdName: string;
  onCreateAnyway: () => void;
  onBeforeNavigate?: () => void;
}

function NoticeRow({ message, householdId, householdName, onCreateAnyway, onBeforeNavigate }: NoticeRowProps) {
  const navigate = useNavigate();

  return (
    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
      <div className="flex items-start gap-2">
        <Warning className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-900">{message}</p>
      </div>
      <div className="flex flex-wrap gap-2 pl-7">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-amber-300 bg-white"
          onClick={() => {
            onBeforeNavigate?.();
            void navigate(`/customers/${householdId}`);
          }}
        >
          Open {householdName}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCreateAnyway}>
          Create anyway
        </Button>
      </div>
    </div>
  );
}

interface ContactDuplicateNoticeProps {
  email: string;
  phone: string;
  /** Matches inside this household are expected (shared numbers) — hide them. */
  excludeHouseholdId?: string;
  /** e.g. close the hosting modal before deep-linking away. */
  onBeforeNavigate?: () => void;
}

export function ContactDuplicateNotice({
  email,
  phone,
  excludeHouseholdId,
  onBeforeNavigate,
}: ContactDuplicateNoticeProps) {
  const { contacts } = useDuplicateLookup({ email, phone });
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  const matches = contacts.filter(m => m.household_id !== excludeHouseholdId);
  const currentKey = `${normaliseEmail(email)}|${normalisePhone(phone)}`;

  if (matches.length === 0 || dismissedKey === currentKey) return null;

  const match = matches[0];
  const others = matches.length - 1;
  const what =
    match.matched.includes('phone') && match.matched.includes('email')
      ? 'This phone number and email are'
      : match.matched.includes('phone')
        ? 'This phone number is'
        : 'This email is';

  return (
    <NoticeRow
      message={
        <>
          {what} already on file for <strong>{match.household_name}</strong>
          {others > 0 && ` (and ${others} more household${others === 1 ? '' : 's'})`}.
        </>
      }
      householdId={match.household_id}
      householdName={match.household_name}
      onCreateAnyway={() => setDismissedKey(currentKey)}
      onBeforeNavigate={onBeforeNavigate}
    />
  );
}

interface HouseholdNameDuplicateNoticeProps {
  name: string;
  /** On back-navigation the household already exists — don't match itself. */
  excludeHouseholdId?: string;
}

export function HouseholdNameDuplicateNotice({ name, excludeHouseholdId }: HouseholdNameDuplicateNoticeProps) {
  const { households } = useDuplicateLookup({ name });
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  const matches = households.filter(h => h.id !== excludeHouseholdId);
  const currentKey = name.trim().toLowerCase();

  if (matches.length === 0 || dismissedKey === currentKey) return null;

  const match = matches[0];
  const others = matches.length - 1;

  return (
    <NoticeRow
      message={
        <>
          A household named <strong>{match.name}</strong> already exists
          {others > 0 && ` (and ${others} more similar)`} — this might be a repeat customer.
        </>
      }
      householdId={match.id}
      householdName={match.name}
      onCreateAnyway={() => setDismissedKey(currentKey)}
    />
  );
}

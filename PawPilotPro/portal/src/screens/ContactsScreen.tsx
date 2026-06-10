import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus, Star, Phone, Mail, MessageCircle } from "lucide-react";
import { usePortalQuery } from "@/hooks/usePortalQuery";
import { Skeleton } from "@/components/Skeleton";
import type { Contact, HouseholdResponse, PreferredContactMethod } from "@shared/types/household";

/**
 * People on the household — primary, emergency, and anyone else the owner
 * wants the team to be able to reach (partner, dog walker, neighbour…).
 * Tap a row to edit; tap + to add. Primary contact cannot be deleted from
 * the list (must reassign first) — that rule is enforced server-side and
 * we just don't show the delete affordance.
 */
export function ContactsScreen() {
  const nav = useNavigate();
  const { data, isLoading } = usePortalQuery<HouseholdResponse>(
    ["portal", "household"],
    "/portal/household",
  );

  return (
    <main className="px-5 pt-4 pb-8 max-w-md mx-auto">
      <header className="flex items-center justify-between gap-2 mb-5 -ml-2 anim-fade-in">
        <button
          type="button"
          onClick={() => nav(-1)}
          className="press p-2 rounded-full hover:bg-secondary/60"
          aria-label="Back"
        >
          <ChevronLeft size={20} strokeWidth={2.2} />
        </button>
        <Link
          to="/account/people/new"
          className="press inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-primary text-primary-foreground text-[13px] font-semibold shadow-[var(--shadow-xs)]"
        >
          <Plus size={14} strokeWidth={2.4} />
          Add person
        </Link>
      </header>

      <section className="anim-fade-in mb-5">
        <p className="text-eyebrow mb-2">People</p>
        <h1 className="text-display-sm leading-tight">Who can we call?</h1>
        <p className="text-[13.5px] text-muted-foreground mt-1.5 leading-relaxed">
          Add anyone we should be able to reach about your pet — partners, family,
          your dog walker, or an emergency contact.
        </p>
      </section>

      {isLoading || !data ? (
        <ul className="space-y-2.5">
          <li><Skeleton className="h-[88px] rounded-2xl" /></li>
          <li><Skeleton className="h-[88px] rounded-2xl opacity-60" /></li>
        </ul>
      ) : data.contacts.length === 0 ? (
        <EmptyContacts />
      ) : (
        <ul className="space-y-2.5">
          {data.contacts.map((co, i) => (
            <li key={co.id} className="anim-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
              <Link
                to={`/account/people/${co.id}`}
                className="press group flex items-start gap-4 bg-card border border-border rounded-2xl p-4 shadow-[var(--shadow-xs)] hover:border-primary/40 hover:shadow-[var(--shadow-md)]"
              >
                <Avatar contact={co} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-[15px] leading-tight">
                      {co.first_name} {co.last_name}
                    </h3>
                    {co.is_primary && <Chip>Primary</Chip>}
                    {co.is_emergency_contact && <Chip tone="warn">Emergency</Chip>}
                  </div>
                  <ContactLines co={co} />
                </div>
                <ChevronRight
                  size={18}
                  strokeWidth={2}
                  className="text-muted-foreground/70 shrink-0 mt-1 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function Avatar({ contact }: { contact: Contact }) {
  const initial = (contact.first_name || contact.last_name || "?").charAt(0).toUpperCase();
  return (
    <div
      className="size-11 rounded-full bg-secondary text-secondary-foreground grid place-items-center text-[15px] font-semibold shrink-0"
      aria-hidden="true"
    >
      {contact.is_primary ? <Star size={16} strokeWidth={2.2} /> : initial}
    </div>
  );
}

function ContactLines({ co }: { co: Contact }) {
  const lines: { icon: typeof Phone; value: string }[] = [];
  if (co.email) lines.push({ icon: Mail, value: co.email });
  if (co.phone) lines.push({ icon: methodIcon(co.preferred_contact_method) ?? Phone, value: co.phone });
  if (lines.length === 0 && co.emergency_contact_relationship) {
    return (
      <p className="text-[13px] text-muted-foreground mt-1 truncate">
        {co.emergency_contact_relationship}
      </p>
    );
  }
  if (lines.length === 0) return null;
  return (
    <div className="space-y-0.5 mt-1">
      {lines.map((l, i) => (
        <p key={i} className="text-[13px] text-muted-foreground truncate flex items-center gap-1.5">
          <l.icon size={12} strokeWidth={2} className="shrink-0 opacity-70" />
          <span className="truncate">{l.value}</span>
        </p>
      ))}
    </div>
  );
}

function methodIcon(m: PreferredContactMethod | null) {
  if (m === "sms") return MessageCircle;
  if (m === "phone") return Phone;
  if (m === "email") return Mail;
  return null;
}

function Chip({ children, tone = "primary" }: { children: React.ReactNode; tone?: "primary" | "warn" }) {
  const cls = tone === "warn"
    ? "bg-destructive/10 text-destructive border-destructive/20"
    : "bg-secondary text-secondary-foreground border-primary/20";
  return (
    <span className={`inline-flex items-center text-[10.5px] font-semibold uppercase tracking-wider rounded-full border px-1.5 py-0.5 ${cls}`}>
      {children}
    </span>
  );
}

function EmptyContacts() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 px-5 py-10 text-center anim-fade-in">
      <h3 className="font-semibold text-[15px] mb-1">No one else on this household yet</h3>
      <p className="text-[13px] text-muted-foreground">
        Add a partner, family member, or emergency contact so we can reach
        the right person when it matters.
      </p>
    </div>
  );
}

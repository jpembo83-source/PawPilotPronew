import { ReactNode } from "react";
import { Sparkles } from "lucide-react";

interface Props {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, body, action }: Props) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 px-5 py-9 text-center anim-fade-in">
      <div
        className="mx-auto mb-3 size-10 rounded-full bg-secondary text-secondary-foreground grid place-items-center"
        aria-hidden="true"
      >
        {icon ?? <Sparkles size={18} />}
      </div>
      <h3 className="font-semibold text-[15px] mb-1">{title}</h3>
      {body && (
        <p className="text-[13px] text-muted-foreground max-w-xs mx-auto leading-relaxed">
          {body}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

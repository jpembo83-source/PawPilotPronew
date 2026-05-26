import { ReactNode } from "react";

interface Props {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, body, action }: Props) {
  return (
    <div className="px-6 py-12 text-center space-y-3">
      {icon && <div className="mx-auto text-3xl opacity-60">{icon}</div>}
      <h3 className="text-base font-semibold">{title}</h3>
      {body && <p className="text-sm text-neutral-500 max-w-xs mx-auto">{body}</p>}
      {action}
    </div>
  );
}

interface Props {
  className?: string;
}

export function Skeleton({ className = "" }: Props) {
  return (
    <div
      className={`bg-muted/70 rounded animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}

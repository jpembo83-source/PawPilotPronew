interface Props {
  className?: string;
}

export function Skeleton({ className = "" }: Props) {
  return (
    <div
      className={`bg-neutral-200/70 dark:bg-neutral-800/70 rounded animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}

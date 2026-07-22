"use client";

export function TabButton({
  label,
  count,
  active,
  onClick,
  icon,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`mr-2 flex shrink-0 items-center gap-1.5 border-b-2 pl-1.5 pr-0 pb-2.5 pt-1 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/50 ${
        active ? "border-ink text-ink" : "border-transparent text-ink-soft hover:text-ink"
      }`}
    >
      {icon}
      {label}
      <span
        className={`rounded-full border px-1.5 py-px font-data text-[10px] tabular-nums ${
          active ? "border-hairline-hover text-ink-soft" : "border-hairline text-ink-muted"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

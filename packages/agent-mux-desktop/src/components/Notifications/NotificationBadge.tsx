interface NotificationBadgeProps {
  count: number;
}

export function NotificationBadge({ count }: NotificationBadgeProps) {
  if (count === 0) return null;

  return (
    <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-[#3b82f6] text-white text-[10px] font-medium leading-none">
      {count > 99 ? '99+' : count}
    </span>
  );
}

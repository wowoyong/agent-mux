import type { ReactNode } from 'react';

interface NotificationRingProps {
  active: boolean;
  children: ReactNode;
}

export function NotificationRing({ active, children }: NotificationRingProps) {
  return (
    <div
      className={`rounded transition-shadow duration-300 ${
        active ? 'notification-ring' : ''
      }`}
    >
      {children}
    </div>
  );
}

import React from 'react';
import { Inbox } from 'lucide-react';

export function EmptyState({ icon: Icon = Inbox, title, children }) {
  return (
    <div className="empty">
      <Icon size={32} />
      <h3>{title}</h3>
      {children}
    </div>
  );
}

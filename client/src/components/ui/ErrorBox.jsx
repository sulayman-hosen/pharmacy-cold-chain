import React from 'react';
import { AlertTriangle } from 'lucide-react';

export function ErrorBox({ children }) {
  if (!children) return null;
  return (
    <div className="error" role="alert">
      <AlertTriangle size={17} />
      <span>{children}</span>
    </div>
  );
}

import React from 'react';
import { ShieldCheck, AlertTriangle, Inbox } from 'lucide-react';

export const statusLabels = {
  requested: 'Awaiting review',
  validated: 'Approved',
  packed: 'Packed',
  'dispatch-pending': 'Chart sync pending',
  dispatched: 'In transit',
  received: 'Received',
  cancelled: 'Cancelled'
};

export const dateTime = (v) =>
  v ? new Date(v).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export const time = (v) =>
  v ? new Date(v).toLocaleTimeString(undefined, { month: 'short', day: 'numeric', minute: '2-digit' }) : '—';

export function playExcursionBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {}
}

export function Mark() {
  return (
    <span className="mark">
      <ShieldCheck size={22} />
    </span>
  );
}

export function Status({ value, t }) {
  const labelMap = {
    requested: t?.statusRequested || statusLabels.requested,
    validated: t?.statusValidated || statusLabels.validated,
    packed: t?.statusPacked || statusLabels.packed,
    'dispatch-pending': t?.statusDispatchPending || statusLabels['dispatch-pending'],
    dispatched: t?.statusDispatched || statusLabels.dispatched,
    received: t?.statusReceived || statusLabels.received,
    cancelled: t?.statusCancelled || statusLabels.cancelled
  };
  return (
    <span className={`badge status-${value}`}>
      <span className="dot" />
      {labelMap[value] ?? value}
    </span>
  );
}

export function Button({ children, kind = 'primary', ...props }) {
  return (
    <button className={`button ${kind}`} {...props}>
      {children}
    </button>
  );
}

export function ErrorBox({ children }) {
  return children ? (
    <div className="error" role="alert">
      <AlertTriangle size={17} />
      <span>{children}</span>
    </div>
  ) : null;
}

export function Empty({ icon: Icon = Inbox, title, children }) {
  return (
    <div className="empty">
      <Icon size={32} />
      <h3>{title}</h3>
      {children}
    </div>
  );
}

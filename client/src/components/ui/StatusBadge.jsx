import React from 'react';
import { statusLabels } from '../../utils/formatters';

export function StatusBadge({ value, t }) {
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

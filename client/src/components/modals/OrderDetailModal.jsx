import React, { useState } from 'react';
import { Truck, Check, ArrowRight, Printer } from 'lucide-react';
import { api } from '../../api';
import { Modal } from '../ui/Modal';
import { StatusBadge } from '../ui/StatusBadge';
import { Button } from '../ui/Button';
import { ErrorBox } from '../ui/ErrorBox';
import { TelemetryWidget } from '../widgets/TelemetryWidget';
import { QrHandoffWidget } from '../widgets/QrHandoffWidget';
import { PrintDeliverySlipModal } from './PrintDeliverySlipModal';
import { dateTime, time } from '../../utils/formatters';

export function OrderDetailModal({ item, user, config, t, onClose, onChanged }) {
  const [courier, setCourier] = useState(
    item.courier || (config?.couriers?.[0]?.name ?? 'Courier 07')
  );
  const [packedTemp, setPackedTemp] = useState(item.packedTemp ?? 4);
  const [lot, setLot] = useState(item.lot || 'COLD-LOT-01');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPrintSlip, setShowPrintSlip] = useState(false);

  async function act(url, method = 'POST', body) {
    setBusy(true);
    setError('');
    try {
      await api(url, { method, body });
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const canValidate = user.role === 'pharmacist' && item.status === 'requested';
  const canPack = user.role === 'pharmacist' && item.status === 'validated';
  const canDispatch =
    user.role === 'pharmacist' &&
    ['packed', 'dispatch-pending'].includes(item.status);
  const canReceive =
    user.role === 'nurse' &&
    ['dispatched', 'dispatch-pending'].includes(item.status);
  const canCancel =
    ['requested', 'validated', 'packed'].includes(item.status) &&
    (user.role === 'pharmacist' ||
      (user.role === 'nurse' && item.status === 'requested'));

  return (
    <>
      <Modal
        title={`MedicationRequest ${item._id}`}
        subtitle={`Floor: ${item.floor.toUpperCase()} · Patient: ${item.patient}`}
        wide
        onClose={onClose}
      >
        <div className="modal-content-grid">
          <div>
            <div className="detail-status">
              <StatusBadge value={item.status} t={t} />
              <span className="mono quiet">Quantity: {item.quantity} dose(s)</span>
            </div>
            <ErrorBox>{error}</ErrorBox>

            <div className="detail-medication">
              <label>Prescribed Formulation</label>
              <h3>{item.medication}</h3>
              {item.note && <p className="detail-note">“{item.note}”</p>}
            </div>

            <div className="meta-grid">
              <div>
                <span>Requested by</span>
                <strong>{item.requestedBy}</strong>
              </div>
              <div>
                <span>Requested at</span>
                <strong>{dateTime(item.createdAt)}</strong>
              </div>
              {item.validatedBy && (
                <div>
                  <span>Approved by</span>
                  <strong>{item.validatedBy}</strong>
                </div>
              )}
              {item.packedBy && (
                <div>
                  <span>Packed by</span>
                  <strong>{item.packedBy}</strong>
                </div>
              )}
              {item.dispatchedBy && (
                <div>
                  <span>Dispatched by</span>
                  <strong>{item.dispatchedBy}</strong>
                </div>
              )}
              {item.receivedBy && (
                <div>
                  <span>Received by</span>
                  <strong>{item.receivedBy}</strong>
                </div>
              )}
            </div>

            {['dispatched', 'received'].includes(item.status) && (
              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  background: '#f8fafc',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <small style={{ color: '#64748b', fontWeight: 600, display: 'block' }}>
                    CHAIN OF CUSTODY MANIFEST
                  </small>
                  <strong style={{ fontSize: 13, color: '#0f172a' }}>
                    {item.courier || 'Courier 07'} · Lot: {item.lot || 'COLD-LOT-01'} · {item.packedTemp ?? 4}°C
                  </strong>
                </div>
                <Button kind="secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setShowPrintSlip(true)}>
                  <Printer size={14} /> Print Slip
                </Button>
              </div>
            )}

            {['dispatched', 'received'].includes(item.status) && (
              <TelemetryWidget packedTemp={item.packedTemp} />
            )}

            {canReceive && (
              <QrHandoffWidget
                lot={item.lot}
                onConfirm={() => act(`/indents/${item._id}/receive`)}
                busy={busy}
                t={t}
              />
            )}
          </div>

          <div className="action-sidebar">
            <h4>Workflow actions</h4>

            {canValidate && (
              <div className="action-card">
                <p>Verify formulation match and approve for packing.</p>
                <Button disabled={busy} onClick={() => act(`/indents/${item._id}/validate`)}>
                  <Check size={16} /> {t?.approvePrescription || 'Approve Request'}
                </Button>
              </div>
            )}

            {canPack && (
              <div className="action-card">
                <label>
                  <span>Cold-chain Lot #</span>
                  <input value={lot} onChange={(e) => setLot(e.target.value)} required />
                </label>
                <label>
                  <span>Pack Temperature (°C)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={packedTemp}
                    onChange={(e) => setPackedTemp(Number(e.target.value))}
                    required
                  />
                </label>
                <Button disabled={busy} onClick={() => act(`/indents/${item._id}/pack`, 'POST', { lot, packedTemp })}>
                  {t?.markPacked || 'Confirm Pack & Seal'}
                </Button>
              </div>
            )}

            {canDispatch && (
              <div className="action-card">
                <label>
                  <span>Assign Courier</span>
                  {config?.couriers?.length ? (
                    <select value={courier} onChange={(e) => setCourier(e.target.value)}>
                      {config.couriers.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input value={courier} onChange={(e) => setCourier(e.target.value)} />
                  )}
                </label>
                <Button disabled={busy} onClick={() => act(`/indents/${item._id}/dispatch`, 'POST', { courier })}>
                  <Truck size={16} /> {t?.dispatchCourier || 'Dispatch Courier'}
                </Button>
              </div>
            )}

            {canCancel && (
              <div className="action-card danger-card">
                <Button kind="ghost" disabled={busy} onClick={() => act(`/indents/${item._id}/cancel`)}>
                  {t?.cancelRequest || 'Cancel Medication Request'}
                </Button>
              </div>
            )}

            <div className="journey-summary">
              <small>Timestamps & Events</small>
              <ul>
                <li>Created: {dateTime(item.createdAt)}</li>
                {item.validatedAt && <li>Approved: {dateTime(item.validatedAt)}</li>}
                {item.packedAt && <li>Packed: {dateTime(item.packedAt)}</li>}
                {item.departedAt && <li>Departed: {dateTime(item.departedAt)}</li>}
                {item.expectedArrivalAt && <li>ETA: {time(item.expectedArrivalAt)}</li>}
                {item.receivedAt && <li>Received: {dateTime(item.receivedAt)}</li>}
              </ul>
            </div>
          </div>
        </div>
      </Modal>

      {showPrintSlip && (
        <PrintDeliverySlipModal item={item} onClose={() => setShowPrintSlip(false)} t={t} />
      )}
    </>
  );
}

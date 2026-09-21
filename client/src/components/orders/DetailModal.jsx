import React, { useState, useEffect, useCallback } from 'react';
import { Package, Printer, Truck, ShieldCheck, Send, QrCode, CheckCircle2, Check, FileCheck2 } from 'lucide-react';
import { api } from '../../api';
import { Modal } from '../ui/Modal';
import { Button, Status, ErrorBox, dateTime, time } from '../common/UIComponents';
import { TemperatureTelemetry, QrHandoffSection } from '../telemetry/Telemetry';
import { PrintDeliverySlipModal } from './PrintDeliverySlipModal';

export function DetailModal({ item, user, config, t, onClose, onChanged }) {
  const [row, setRow] = useState(item);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [resource, setResource] = useState(null);
  const [showPrint, setShowPrint] = useState(false);
  const [pack, setPack] = useState({
    temperature: 4,
    lot: 'DEMO-LOT-001',
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  });
  const [delivery, setDelivery] = useState({ courierId: 'C-07', minutes: 15, temperature: 4 });
  const pharmacist = user.role === 'pharmacist';

  const updateDelivery = useCallback(
    async (newDelivery) => {
      setDelivery(newDelivery);
      if (config.integrationMode === 'demo') {
        try {
          const d = await api(`/indents/${row._id}/sample-hl7`, { method: 'POST', body: newDelivery });
          setMessage(d.message.replace(/\r/g, '\n'));
        } catch (e) {
          setError(e.message);
        }
      }
    },
    [row._id, config.integrationMode]
  );

  useEffect(() => {
    if (row.status === 'packed' && !message && config.integrationMode === 'demo') {
      updateDelivery(delivery);
    }
  }, [row.status, message, config.integrationMode, updateDelivery, delivery]);

  useEffect(() => {
    if (row.status !== 'dispatch-pending') return;
    const timer = setInterval(
      () =>
        api(`/indents/${row._id}`)
          .then((d) => {
            setRow(d);
            if (d.status !== 'dispatch-pending') onChanged();
          })
          .catch((e) => setError(e.message)),
      2500
    );
    return () => clearInterval(timer);
  }, [row.status, row._id, onChanged]);

  async function action(name, body = {}) {
    setBusy(true);
    setError('');
    try {
      const d = await api(`/indents/${row._id}/${name}`, { method: 'POST', body });
      setRow(d);
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    setBusy(true);
    try {
      await updateDelivery(delivery);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    setBusy(true);
    setError('');
    try {
      const d = await api('/hl7/dispatch', { method: 'POST', body: { message } });
      setRow(d.indent);
      setMessage('');
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function showOrder() {
    setBusy(true);
    setError('');
    try {
      const d = await api(`/indents/${row._id}`);
      setResource(d.order.resource);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const stages = ['requested', 'validated', 'packed', 'dispatched', 'received'];
  let stage = stages.indexOf(row.status);
  if (row.status === 'dispatch-pending') stage = 2;

  return (
    <Modal wide title="Delivery workspace" subtitle={`${row.prescriptionId} · Request ${row._id.slice(0, 8)}`} onClose={onClose}>
      <div className="detail-heading">
        <div>
          <h3>{row.requestedName || row.validation?.name}</h3>
          <p>
            {row.dose} {row.unit} · {row.patientRef} · {row.floor.toUpperCase()}
          </p>
        </div>
        <Status value={row.status} t={t} />
      </div>

      <div className="stepper">
        {stages.map((s, i) => (
          <div key={s} className={i <= stage ? 'complete' : ''}>
            <span>{i < stage ? <Check size={13} /> : i + 1}</span>
            <small>{['Requested', 'Approved', 'Packed', 'In transit', 'Received'][i]}</small>
          </div>
        ))}
      </div>

      <div className="facts" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <div>
          <small>PATIENT ID / MRN (PID-3)</small>
          <strong>{row.patientRef}</strong>
        </div>
        <div>
          <small>ORDERING NURSE (ORC-12)</small>
          <strong>{row.nurseName || 'Nurse Jamie (NURSE-552)'}</strong>
        </div>
        <div>
          <small>DESTINATION (PV1-3)</small>
          <strong>
            Floor: {row.floor?.toUpperCase()} · Room: {row.room || '402'} · Bed: {row.bed || 'Bed B'}
          </strong>
        </div>
        <div>
          <small>RXNORM CONCEPT</small>
          <strong>{row.rxcui}</strong>
        </div>
        <div>
          <small>CHECKED AGAINST</small>
          <strong>{row.validation?.source === 'synthetic-fixture' ? 'Demo terminology' : 'NIH RxNorm'}</strong>
        </div>
        <div>
          <small>REQUESTED AT</small>
          <strong>{dateTime(row.createdAt)}</strong>
        </div>
      </div>

      {row.packed && (
        <>
          <div className="order-callout">
            <Package size={23} />
            <div>
              <strong>Package ready · {row.packed.temperature}°C</strong>
              <p>
                Lot {row.packed.lot} · Packed {time(row.packed.at)} · Policy {row.packed.policy.minC}–{row.packed.policy.maxC}°C
              </p>
            </div>
            <Button kind="secondary" onClick={() => setShowPrint(true)}>
              <Printer size={16} />
              {t?.printSlip || 'Print Label Manifest'}
            </Button>
          </div>
          <TemperatureTelemetry packedTemp={row.packed.temperature} />
        </>
      )}

      {row.dispatch && (
        <div
          className="order-callout"
          style={{ background: '#f0f9ff', borderColor: '#0284c7', flexDirection: 'column', alignItems: 'stretch', gap: 10 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Truck size={26} color="#0284c7" />
            <div>
              <strong style={{ fontSize: 15, color: '#0369a1' }}>
                🚚 Courier Transport:{' '}
                {row.dispatch.courierName || config.couriers.find((c) => c.id === row.dispatch.courierId)?.label || row.dispatch.courierId}{' '}
                (ID: {row.dispatch.courierId})
              </strong>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: '#334155' }}>
                <strong>Departed:</strong> {time(row.dispatch.departedAt)} · <strong>ETA:</strong> {time(row.dispatch.eta)} ·{' '}
                <strong>Dispatch Temp:</strong> {row.dispatch.temperature}°C
              </p>
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#0369a1', background: '#e0f2fe', padding: 8, borderRadius: 6 }}>
            {row.status === 'dispatch-pending'
              ? 'Departure accepted. The EHR chart sync is queued; nurse push alert follows successful write.'
              : 'The departure has been recorded in the patient chart and delivered by courier.'}
          </div>
        </div>
      )}

      {pharmacist && row.status === 'requested' && (
        <div className="action-area">
          <h3>Pharmacist verification</h3>
          <p className="muted">Re-read the current prescription and verify the exact formulation before approving.</p>
          <Button disabled={busy} onClick={() => action('validate')}>
            <ShieldCheck size={17} />
            Approve request
          </Button>
        </div>
      )}

      {pharmacist && row.status === 'validated' && (
        <form
          className="action-area"
          onSubmit={(e) => {
            e.preventDefault();
            action('pack', {
              ...pack,
              temperature: Number(pack.temperature),
              expiresAt: new Date(pack.expiresAt + 'T23:59:59Z').toISOString()
            });
          }}
        >
          <h3>Pack & record the cold chain</h3>
          <div className="form-grid three">
            <label>
              Temperature (°C)
              <input
                required
                type="number"
                step="0.1"
                value={pack.temperature}
                onChange={(e) => setPack({ ...pack, temperature: e.target.value })}
              />
            </label>
            <label>
              Batch / lot
              <input required value={pack.lot} onChange={(e) => setPack({ ...pack, lot: e.target.value })} />
            </label>
            <label>
              Expiry date
              <input required type="date" value={pack.expiresAt} onChange={(e) => setPack({ ...pack, expiresAt: e.target.value })} />
            </label>
          </div>
          <Button disabled={busy}>
            <Package size={17} />
            Confirm packing
          </Button>
        </form>
      )}

      {pharmacist && row.status === 'packed' && (
        <div className="action-area">
          <h3>Process courier departure</h3>
          <p className="muted">Select assigned courier and submit an OMP^O09 message from the pharmacy interface.</p>
          {config.integrationMode === 'demo' && (
            <>
              <div className="form-grid three">
                <label>
                  Courier Name & ID
                  <select value={delivery.courierId} onChange={(e) => updateDelivery({ ...delivery, courierId: e.target.value })}>
                    {config.couriers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  ETA in minutes
                  <input
                    type="number"
                    min="1"
                    max="240"
                    value={delivery.minutes}
                    onChange={(e) => updateDelivery({ ...delivery, minutes: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Departure °C
                  <input
                    type="number"
                    step="0.1"
                    value={delivery.temperature}
                    onChange={(e) => updateDelivery({ ...delivery, temperature: Number(e.target.value) })}
                  />
                </label>
              </div>
              <Button kind="secondary" disabled={busy} onClick={generate}>
                <Send size={16} />
                Generate demo HL7
              </Button>
            </>
          )}
          <label className="top-gap">
            HL7 message
            <textarea
              className="code-input"
              rows="7"
              placeholder="MSH|^~\&|..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          <Button disabled={busy || !message.trim()} onClick={send}>
            <Send size={16} />
            Process departure
          </Button>
        </div>
      )}

      {user.role === 'nurse' && row.status === 'dispatched' && (
        <div className="action-area">
          <h3>Delivery received?</h3>
          <p className="muted">Confirm the handoff after checking the package. This records receipt, not medication administration.</p>
          <QrHandoffSection lot={row.packed?.lot || 'DEMO-LOT'} onConfirm={() => action('receive')} busy={busy} t={t} />
        </div>
      )}

      <ErrorBox>{error}</ErrorBox>

      <div className="modal-actions split">
        <Button kind="ghost" disabled={busy} onClick={showOrder}>
          <FileCheck2 size={16} />
          View FHIR prescription
        </Button>
        {['requested', 'validated', 'packed'].includes(row.status) && (
          <Button kind="danger" disabled={busy} onClick={() => action('cancel')}>
            Cancel request
          </Button>
        )}
      </div>

      {resource && (
        <details open className="resource">
          <summary>MedicationRequest · FHIR R4</summary>
          <pre>{JSON.stringify(resource, null, 2)}</pre>
        </details>
      )}

      {showPrint && <PrintDeliverySlipModal row={row} onClose={() => setShowPrint(false)} t={t} />}
    </Modal>
  );
}

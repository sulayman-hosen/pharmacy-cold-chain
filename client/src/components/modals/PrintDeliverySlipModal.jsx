import React from 'react';
import { Printer } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import { dateTime, time } from '../../utils/formatters';

export function PrintDeliverySlipModal({ item, onClose, t }) {
  function triggerPrint() {
    window.print();
  }

  return (
    <Modal
      wide
      title="Cold-Chain Delivery Slip & Chain of Custody"
      subtitle="Official hospital dispatch manifest for cold-chain transport."
      onClose={onClose}
    >
      <div
        className="printable-manifest"
        style={{
          padding: 20,
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: 10
        }}
      >
        <div
          className="print-manifest-head"
          style={{
            borderBottom: '2px solid #0f172a',
            paddingBottom: 12,
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <strong style={{ fontSize: 18, color: '#0f172a', display: 'block' }}>
              COLDLINE HOSPITAL DISPATCH MANIFEST
            </strong>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
              FHIR R4 MedicationDispense · HL7 OMP^O09 Standard
            </p>
          </div>
          <StatusBadge value={item.status} t={t} />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 14,
            fontSize: 13,
            marginBottom: 16
          }}
        >
          <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <small style={{ fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block' }}>INDENT ID</small>
            <strong style={{ fontSize: 14, color: '#0f172a' }}>{item._id}</strong>
          </div>
          <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <small style={{ fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block' }}>TARGET IPD FLOOR</small>
            <strong style={{ fontSize: 14, color: '#0f172a' }}>{item.floor.toUpperCase()}</strong>
          </div>
          <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <small style={{ fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block' }}>PATIENT ID</small>
            <strong style={{ fontSize: 14, color: '#0f172a' }}>{item.patient}</strong>
          </div>
          <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <small style={{ fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block' }}>MEDICATION STATEMENT</small>
            <strong style={{ fontSize: 13, color: '#0f172a' }}>{item.medication}</strong>
          </div>
          <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <small style={{ fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block' }}>COURIER / CARRIER</small>
            <strong style={{ fontSize: 14, color: '#0284c7' }}>{item.courier || 'Unassigned'}</strong>
          </div>
          <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <small style={{ fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block' }}>COLD-CHAIN LOT & TEMP</small>
            <strong style={{ fontSize: 14, color: '#059669' }}>
              {item.lot || 'COLD-LOT-01'} · {item.packedTemp ?? 4}°C
            </strong>
          </div>
          <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <small style={{ fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block' }}>DEPARTURE TIME</small>
            <strong style={{ fontSize: 13, color: '#0f172a' }}>{dateTime(item.departedAt)}</strong>
          </div>
          <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <small style={{ fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block' }}>ESTIMATED ARRIVAL (ETA)</small>
            <strong style={{ fontSize: 13, color: '#0f172a' }}>{time(item.expectedArrivalAt)}</strong>
          </div>
        </div>

        <div className="print-signatures" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 24, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
          <div>
            <div style={{ borderBottom: '1px solid #94a3b8', height: 32, marginBottom: 4 }} />
            <small style={{ fontSize: 11, color: '#64748b' }}>Pharmacist Signature & Stamp</small>
          </div>
          <div>
            <div style={{ borderBottom: '1px solid #94a3b8', height: 32, marginBottom: 4 }} />
            <small style={{ fontSize: 11, color: '#64748b' }}>Receiving Ward Nurse Signature</small>
          </div>
        </div>

        <div className="print-barcode" style={{ textAlign: 'center', marginTop: 16, borderTop: '1px dashed #cbd5e1', paddingTop: 12 }}>
          <svg width="240" height="40" viewBox="0 0 240 40">
            <rect x="0" y="0" width="240" height="40" fill="#ffffff" />
            <path
              d="M10 5h4v30h-4zM20 5h2v30h-2zM28 5h6v30h-6zM40 5h2v30h-2zM48 5h8v30h-8zM60 5h4v30h-4zM70 5h2v30h-2zM78 5h6v30h-6zM90 5h4v30h-4zM100 5h2v30h-2zM108 5h8v30h-8zM122 5h4v30h-4zM132 5h2v30h-2zM140 5h6v30h-6zM152 5h4v30h-4zM162 5h8v30h-8zM176 5h4v30h-4zM186 5h2v30h-2zM194 5h6v30h-6zM206 5h4v30h-4zM216 5h2v30h-2zM224 5h6v30h-6z"
              fill="#0f172a"
            />
          </svg>
          <small style={{ letterSpacing: 2, fontFamily: 'monospace', fontSize: 11, display: 'block', color: '#475569' }}>
            *{item._id}*
          </small>
        </div>
      </div>

      <div className="modal-actions" style={{ marginTop: 16 }}>
        <Button kind="secondary" onClick={onClose}>
          Close
        </Button>
        <Button onClick={triggerPrint}>
          <Printer size={16} /> Print Delivery Slip
        </Button>
      </div>
    </Modal>
  );
}

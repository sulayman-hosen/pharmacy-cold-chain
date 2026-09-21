import React from 'react';
import { Printer } from 'lucide-react';
import { Modal, Button } from '../common/UIComponents';

export function PrintDeliverySlipModal({ row, onClose, t }) {
  const nurseName = row.nurseName || 'Nurse Jamie (NURSE-552)';
  const room = row.room || '402';
  const bed = row.bed || 'Bed B';
  const courierInfo = row.dispatch?.courierName || row.dispatch?.courierId || 'Alex Rivera (Courier C-07)';

  function triggerPrint() {
    const originalTitle = document.title;
    const pId = row?.prescriptionId || 'manifest';
    const orderId = row?._id ? row._id.slice(0, 8) : 'order';
    const now = new Date();
    const dateStamp = now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');
    const timeStamp = String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0');

    document.title = `Coldline-Manifest-${pId}-${orderId}-${dateStamp}-${timeStamp}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  }

  return (
    <Modal title={t?.printSlip || "Print Box Manifest Label"} subtitle="Cold chain delivery slip with complete location & courier info." onClose={onClose}>
      <div className="print-manifest" style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: 16, background: '#ffffff' }}>
        <div className="print-manifest-head" style={{ borderBottom: '2px solid #0f172a', paddingBottom: 8, marginBottom: 12 }}>
          <div>
            <strong style={{ fontSize: 16, color: '#0f172a' }}>COLDLINE PHARMACY HANDOFF MANIFEST</strong>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Medication Request #{row.prescriptionId} · Order #{row._id.slice(0, 8)}</p>
          </div>
          <span className="small-tag" style={{ borderColor: '#059669', color: '#059669', fontWeight: 700 }}>2°C – 8°C COLD CHAIN</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13, marginBottom: 12 }}>
          <div style={{ gridColumn: 'span 2', background: '#f8fafc', padding: 8, borderRadius: 6 }}>
            <strong>📦 MEDICATION & FORMULATION:</strong>
            <div style={{ fontSize: 14, color: '#0284c7', fontWeight: 700, marginTop: 2 }}>{row.validation?.name}</div>
            <div style={{ fontSize: 13, color: '#334155' }}>{row.dose} {row.unit} · Route SNOMED: {row.route}</div>
          </div>

          <div>
            <small style={{ fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block' }}>PATIENT ID / MRN (PID-3)</small>
            <strong style={{ fontSize: 13, color: '#0f172a' }}>{row.patientRef}</strong>
          </div>

          <div>
            <small style={{ fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block' }}>ORDERING NURSE (ORC-12)</small>
            <strong style={{ fontSize: 13, color: '#0f172a' }}>{nurseName}</strong>
          </div>

          <div style={{ gridColumn: 'span 2', background: '#ecfdf5', padding: 8, borderRadius: 6, border: '1px solid #a7f3d0' }}>
            <small style={{ fontSize: 11, color: '#047857', fontWeight: 700, display: 'block' }}>DESTINATION LOCATION (PV1-3)</small>
            <strong style={{ fontSize: 14, color: '#065f46' }}>
              Floor: {row.floor?.toUpperCase()} · Room: {room} · Bed/Cabin: {bed}
            </strong>
          </div>

          <div style={{ gridColumn: 'span 2', background: '#f0f9ff', padding: 8, borderRadius: 6, border: '1px solid #bae6fd' }}>
            <small style={{ fontSize: 11, color: '#0369a1', fontWeight: 700, display: 'block' }}>COURIER ASSIGNMENT & COLD CHAIN</small>
            <strong style={{ fontSize: 13, color: '#0369a1' }}>
              Courier: {courierInfo} · Batch/Lot: {row.packed?.lot || 'DEMO-LOT-001'} ({row.packed?.temperature || 4}°C)
            </strong>
          </div>
        </div>

        <div className="print-barcode" style={{ textAlign: 'center', marginTop: 12 }}>
          <svg width="220" height="45" viewBox="0 0 220 50">
            <rect x="0" y="0" width="220" height="50" fill="#ffffff" />
            <path d="M10 5h4v40h-4zM20 5h2v40h-2zM28 5h6v40h-6zM40 5h2v40h-2zM48 5h8v40h-8zM60 5h4v40h-4zM70 5h2v40h-2zM78 5h6v40h-6zM90 5h4v40h-4zM100 5h2v40h-2zM108 5h8v40h-8zM122 5h4v40h-4zM132 5h2v40h-2zM140 5h6v40h-6zM152 5h4v40h-4zM162 5h8v40h-8zM176 5h4v40h-4zM186 5h2v40h-2zM194 5h6v40h-6z" fill="#0f172a" />
          </svg>
          <small style={{ letterSpacing: 2, fontFamily: 'monospace', fontSize: 11, display: 'block' }}>*{row.prescriptionId}*</small>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: 6, marginTop: 8 }}>
          <span>Packed Temp: {row.packed?.temperature || 4}°C</span>
          <span>Printed: {new Date().toLocaleString()}</span>
        </div>
      </div>

      <div className="modal-actions">
        <Button kind="secondary" onClick={onClose}>Close</Button>
        <Button onClick={triggerPrint}><Printer size={16} /> Print Label Manifest</Button>
      </div>
    </Modal>
  );
}

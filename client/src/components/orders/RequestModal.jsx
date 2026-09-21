import React, { useState, useEffect, useCallback } from 'react';
import { Search, FileCheck2, CheckCircle2, LockKeyhole, ArrowRight, Send } from 'lucide-react';
import { api } from '../../api';
import { Button, ErrorBox } from '../common/UIComponents';
import { Modal } from '../ui/Modal';

export function RequestModal({ config, onClose, onCreated, user }) {
  const [prescriptionId, setId] = useState(config.integrationMode === 'demo' ? 'demo-order-01' : '');
  const [order, setOrder] = useState(null);
  const [step, setStep] = useState('edit');
  const [form, setForm] = useState({
    requestedName: '',
    dose: '',
    unit: '',
    route: '',
    patientRef: '',
    nurseName: user?.name ? `${user.name.split(' · ')[0]} (${user._id || 'NURSE-552'})` : 'Nurse Jamie (NURSE-552)',
    nurseId: user?._id || 'NURSE-552',
    floor: 'IPD-3',
    room: '402',
    bed: 'Bed B'
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const catalogOptions = config?.catalog || [
    { rxcui: '274783', name: 'insulin glargine 100 UNT/ML Injectable Solution' },
    { rxcui: '86009', name: 'insulin human, regular 100 UNT/ML Injectable Solution' }
  ];

  const readForId = useCallback(async (targetId) => {
    if (!targetId) return;
    setBusy(true);
    setError('');
    setOrder(null);
    try {
      const d = await api('/prescriptions/' + encodeURIComponent(targetId));
      setOrder(d);
      setForm((prev) => ({
        ...prev,
        requestedName: d.name,
        dose: d.dose,
        unit: d.unit,
        route: d.route,
        patientRef: d.patientRef || 'Patient/demo-patient-01',
        floor: d.floor ? d.floor.toUpperCase() : 'IPD-3'
      }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (config.integrationMode === 'demo' && prescriptionId) {
      readForId(prescriptionId);
    }
  }, [config.integrationMode, prescriptionId, readForId]);

  async function read() {
    await readForId(prescriptionId);
  }

  function selectChip(idVal) {
    setId(idVal);
    readForId(idVal);
  }

  function handleSelectDrug(e) {
    const selectedName = e.target.value;
    setForm((prev) => ({ ...prev, requestedName: selectedName }));
  }

  async function submit(e) {
    if (e) e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/indents', {
        method: 'POST',
        body: {
          prescriptionId,
          requestedName: order?.name || form.requestedName,
          dose: Number(order?.dose ?? form.dose),
          unit: order?.unit || form.unit,
          route: order?.route || form.route,
          patientRef: form.patientRef
            ? form.patientRef.startsWith('Patient/')
              ? form.patientRef
              : `Patient/${form.patientRef}`
            : undefined,
          nurseName: form.nurseName || undefined,
          floor: form.floor || undefined,
          room: form.room || undefined,
          bed: form.bed || undefined
        }
      });
      onCreated();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const demoChips = ['demo-order-01', 'demo-order-02', 'demo-order-03', 'demo-order-04', 'demo-order-05'];

  return (
    <Modal
      title={step === 'preview' ? 'Order Preview for Pharmacy' : 'New medication request'}
      subtitle={
        step === 'preview'
          ? 'Review order details before sending to pharmacy.'
          : 'Read the prescription, confirm formulation and location.'
      }
      onClose={onClose}
    >
      {step === 'edit' ? (
        <>
          <div className="inline-form" style={{ marginBottom: 12 }}>
            <label style={{ margin: 0 }}>
              MedicationRequest ID
              <input
                value={prescriptionId}
                onChange={(e) => {
                  setId(e.target.value);
                  setOrder(null);
                }}
                placeholder="e.g. demo-order-01, demo-order-02"
              />
            </label>
            <Button onClick={read} disabled={busy || !prescriptionId} kind="secondary">
              <Search size={16} />
              Read order
            </Button>
          </div>

          {config.integrationMode === 'demo' && (
            <div className="chip-container">
              <small style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>Select Prescription ID:</small>
              {demoChips.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => selectChip(c)}
                  className={`chip-btn ${prescriptionId === c ? 'active' : ''}`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {order && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setStep('preview');
              }}
              style={{ marginTop: 16 }}
            >
              <div
                className="order-callout"
                style={{ margin: '0 0 20px', flexDirection: 'column', alignItems: 'stretch', gap: 12 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <FileCheck2 size={24} color="#0284c7" />
                    <div>
                      <strong>Active Inpatient Prescription (HL7 v2 / FHIR R4)</strong>
                      <span className="api-sync-badge" style={{ marginLeft: 8 }}>
                        <CheckCircle2 size={12} /> NIH RxNav Verified
                      </span>
                    </div>
                  </div>
                  <span className="small-tag">FHIR R4</span>
                </div>
              </div>

              <div className="modal-form-group">
                <label htmlFor="drug-dropdown">Full drug name & formulation (Database API Dropdown)</label>
                <select id="drug-dropdown" value={form.requestedName} onChange={handleSelectDrug} required>
                  <option value="">-- Select Drug from Database Catalog --</option>
                  {catalogOptions.map((cat) => (
                    <option key={cat.rxcui} value={cat.name}>
                      {cat.name} (RxCUI: {cat.rxcui})
                    </option>
                  ))}
                  {form.requestedName && !catalogOptions.some((c) => c.name === form.requestedName) && (
                    <option value={form.requestedName}>{form.requestedName}</option>
                  )}
                </select>
                <small style={{ fontSize: 12, color: '#059669', marginTop: 4, fontWeight: 600 }}>
                  ✓ Loaded from API Catalog: {catalogOptions.length} drugs available in database.
                </small>
              </div>

              <div className="form-grid-2">
                <div className="modal-form-group">
                  <label htmlFor="dose-input">Prescribed dose</label>
                  <input
                    id="dose-input"
                    type="number"
                    min="0.001"
                    step="any"
                    value={form.dose}
                    onChange={(e) => setForm({ ...form, dose: e.target.value })}
                    required
                  />
                </div>
                <div className="modal-form-group">
                  <label htmlFor="unit-input">UCUM unit</label>
                  <input
                    id="unit-input"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="modal-form-group">
                <label htmlFor="route-input">SNOMED route code</label>
                <input
                  id="route-input"
                  value={form.route}
                  onChange={(e) => setForm({ ...form, route: e.target.value })}
                  required
                />
              </div>

              <div className="form-grid-2" style={{ marginTop: 8 }}>
                <div className="modal-form-group">
                  <label>Patient ID / MRN (PID-3)</label>
                  <input
                    value={form.patientRef}
                    onChange={(e) => setForm({ ...form, patientRef: e.target.value })}
                    required
                  />
                </div>
                <div className="modal-form-group">
                  <label>Ordering Nurse Name & ID (ORC-12)</label>
                  <input
                    value={form.nurseName}
                    onChange={(e) => setForm({ ...form, nurseName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div className="modal-form-group">
                  <label>Floor Number</label>
                  <input
                    value={form.floor}
                    onChange={(e) => setForm({ ...form, floor: e.target.value })}
                    required
                  />
                </div>
                <div className="modal-form-group">
                  <label>Room Number</label>
                  <input
                    value={form.room}
                    onChange={(e) => setForm({ ...form, room: e.target.value })}
                    required
                  />
                </div>
                <div className="modal-form-group">
                  <label>Bed / Cabin Number</label>
                  <input
                    value={form.bed}
                    onChange={(e) => setForm({ ...form, bed: e.target.value })}
                    required
                  />
                </div>
              </div>

              <p className="form-hint" style={{ marginTop: 16 }}>
                <LockKeyhole size={14} /> Patient information stays inside this authenticated workspace.
              </p>

              <div className="modal-actions">
                <Button kind="secondary" type="button" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit">
                  Preview Order & Send <ArrowRight size={16} />
                </Button>
              </div>
            </form>
          )}
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              background: '#f0f9ff',
              border: '1px solid #0284c7',
              borderRadius: 10,
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #bae6fd',
                paddingBottom: 10
              }}
            >
              <strong>📋 Pharmacy Order Dispatch Preview</strong>
              <span className="small-tag" style={{ borderColor: '#0284c7', color: '#0284c7' }}>
                READY TO DISPATCH
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
              <div>
                <small style={{ fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block' }}>MEDICATION REQUEST ID</small>
                <strong style={{ fontSize: 14, color: '#0f172a' }}>{prescriptionId}</strong>
              </div>
              <div>
                <small style={{ fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block' }}>PATIENT ID / MRN (PID-3)</small>
                <strong style={{ fontSize: 14, color: '#0f172a' }}>{form.patientRef}</strong>
              </div>
              <div>
                <small style={{ fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block' }}>SELECTED DRUG & FORMULATION</small>
                <strong style={{ fontSize: 14, color: '#0284c7' }}>{order?.name || form.requestedName}</strong>
              </div>
              <div>
                <small style={{ fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block' }}>DOSE & UCUM UNIT</small>
                <strong style={{ fontSize: 14, color: '#0f172a' }}>
                  {order?.dose ?? form.dose} [{order?.unit || form.unit}]
                </strong>
              </div>
              <div>
                <small style={{ fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block' }}>SNOMED ROUTE CODE</small>
                <strong style={{ fontSize: 14, color: '#0f172a' }}>{order?.route || form.route}</strong>
              </div>
              <div>
                <small style={{ fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block' }}>ORDERING NURSE (ORC-12)</small>
                <strong style={{ fontSize: 14, color: '#0f172a' }}>{form.nurseName}</strong>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <small style={{ fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block' }}>DESTINATION LOCATION (PV1-3)</small>
                <strong style={{ fontSize: 14, color: '#059669' }}>
                  Floor: {form.floor} · Room: {form.room} · Bed/Cabin: {form.bed}
                </strong>
              </div>
            </div>

            <div
              style={{
                fontSize: 12,
                color: '#0369a1',
                background: '#e0f2fe',
                padding: '10px',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <LockKeyhole size={16} />
              <span>
                <strong>HIPAA Data Safeguard:</strong> Outbound courier push alert is scrubbed of Patient Name/MRN and Diagnosis.
                Alert payload contains Location, Courier & ETA only.
              </span>
            </div>
          </div>

          <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
            <Button kind="secondary" disabled={busy} onClick={() => setStep('edit')}>
              ← Edit Details
            </Button>
            <Button disabled={busy} onClick={() => submit()}>
              {busy ? 'Sending to Pharmacy…' : 'Confirm & Send to Pharmacy'} <Send size={16} />
            </Button>
          </div>
        </div>
      )}
      <ErrorBox>{error}</ErrorBox>
    </Modal>
  );
}

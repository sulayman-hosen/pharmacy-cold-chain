import React, { useState } from 'react';
import { api } from '../../api';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ErrorBox } from '../ui/ErrorBox';

export function RequestMedicationModal({ config, user, onClose, onCreated }) {
  const [form, setForm] = useState({
    floor: user.floors[0] || 'ipd-3',
    patient: 'demo-patient-01',
    medication: 'insulin glargine 100 UNT/ML Injectable Solution',
    quantity: 1,
    note: ''
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/indents', { method: 'POST', body: form });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Request cold-chain delivery"
      subtitle="Creates an active FHIR MedicationRequest for inpatient ward delivery."
      onClose={onClose}
    >
      <form onSubmit={submit} className="form-stack">
        <ErrorBox>{error}</ErrorBox>
        <div className="grid-2">
          <label>
            <span>Target IPD floor</span>
            <select
              value={form.floor}
              onChange={(e) => setForm({ ...form, floor: e.target.value })}
            >
              {user.floors.map((f) => (
                <option key={f} value={f}>
                  {f.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Patient ID (FHIR Subject)</span>
            <input
              value={form.patient}
              onChange={(e) => setForm({ ...form, patient: e.target.value })}
              required
            />
          </label>
        </div>
        <label>
          <span>RxNorm medication statement</span>
          <input
            value={form.medication}
            onChange={(e) => setForm({ ...form, medication: e.target.value })}
            required
          />
        </label>
        <div className="grid-2">
          <label>
            <span>Quantity (Doses)</span>
            <input
              type="number"
              min="1"
              max="10"
              value={form.quantity}
              onChange={(e) =>
                setForm({ ...form, quantity: Number(e.target.value) })
              }
              required
            />
          </label>
          <label>
            <span>Special instructions</span>
            <input
              placeholder="e.g. STAT delivery to Room 402"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </label>
        </div>
        <div className="modal-actions">
          <Button kind="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Submitting request…' : 'Submit MedicationRequest'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

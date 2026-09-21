import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  ChevronRight,
  Printer,
  CheckCircle2,
  FileCheck2,
  Filter
} from 'lucide-react';
import { api } from '../../api';
import { Button } from '../../components/ui/Button';
import { ErrorBox } from '../../components/ui/ErrorBox';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { WorklistTable } from '../common/WorklistTable';
import { OrderDetailModal } from '../../components/modals/OrderDetailModal';
import { AuditCertificateModal } from '../../components/modals/AuditCertificateModal';
import { dateTime } from '../../utils/formatters';

export function AuditorDashboard({ t }) {
  const [subTab, setSubTab] = useState('audit'); // 'audit' | 'orders'
  const [rows, setRows] = useState([]);
  const [indents, setIndents] = useState([]);
  const [verification, setVerification] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [selectedIndent, setSelectedIndent] = useState(null);
  const [showCertModal, setShowCertModal] = useState(false);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'mismatched' | 'valid'

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  async function refresh() {
    setBusy(true);
    try {
      const data = await api('/audit/chain');
      setRows(data.records || []);
      setVerification(data.verification || null);

      const indentsData = await api('/indents');
      setIndents(indentsData || []);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function repairChain() {
    setBusy(true);
    try {
      await api('/audit/repair', { method: 'POST' });
      await refresh();
      setSelectedAudit(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteTamperedRecord(seq) {
    if (!window.confirm(`Are you sure you want to delete tampered record #${seq} and repair the audit chain?`)) {
      return;
    }
    setBusy(true);
    try {
      await api(`/audit/records/${seq}`, { method: 'DELETE' });
      await refresh();
      setSelectedAudit(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function renderEventBadge(subtypeCode) {
    switch (subtypeCode) {
      case 'read':
        return <span className="badge status-validated">Read (FHIR GET)</span>;
      case 'request':
        return <span className="badge status-packed">MedicationRequest</span>;
      case 'validate':
        return <span className="badge status-validated">Validate / Approve</span>;
      case 'pack':
        return <span className="badge status-packed">Pack & Seal</span>;
      case 'dispatch':
        return <span className="badge status-dispatched">Dispatch (HL7/FHIR)</span>;
      case 'receive':
        return <span className="badge status-received">Receive & Handoff</span>;
      case 'cancel':
        return <span className="badge status-cancelled">Cancel Request</span>;
      default:
        return <span className="badge status-requested">{subtypeCode}</span>;
    }
  }

  const failedSeq = verification?.failedAt || verification?.failedRecord?.seq || null;

  const filteredRows = rows.filter(r => {
    const isMismatched = !verification?.valid && (r.seq === failedSeq || r._id === verification?.failedRecord?._id);
    if (filterType === 'mismatched') return isMismatched;
    if (filterType === 'valid') return !isMismatched;
    return true;
  });

  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">COMPLIANCE & INTEGRITY</div>
          <h1>Cryptographic Audit Trail</h1>
          <p>HMAC-SHA256 chained ledger logging all FHIR resources and patient access.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button kind="secondary" onClick={refresh}>
            <RefreshCw size={16} /> Verify Chain
          </Button>
          <Button
            onClick={() => setShowCertModal(true)}
            style={{ background: '#059669', color: '#fff' }}
          >
            <Printer size={16} /> Generate Audit Certificate
          </Button>
        </div>
      </div>

      <ErrorBox>{error}</ErrorBox>

      {verification && (
        <div
          style={{
            background: verification.valid ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${verification.valid ? '#a7f3d0' : '#fca5a5'}`,
            borderRadius: 8,
            padding: 16,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {verification.valid ? (
              <ShieldCheck size={28} style={{ color: '#059669' }} />
            ) : (
              <AlertTriangle size={28} style={{ color: '#dc2626' }} />
            )}
            <div>
              <strong
                style={{
                  fontSize: 16,
                  color: verification.valid ? '#047857' : '#dc2626',
                  display: 'block'
                }}
              >
                {verification.valid
                  ? `✓ Cryptographic Ledger Intact (${verification.checked} records verified)`
                  : `⚠️ Audit Ledger Mismatch Detected at Record #${failedSeq || 'Unknown'}`}
              </strong>
              <small
                style={{
                  color: verification.valid ? '#065f46' : '#991b1b',
                  fontSize: 12,
                  display: 'block',
                  marginTop: 2
                }}
              >
                {verification.valid
                  ? `Head HMAC Hash: ${verification.headHash?.slice(0, 32)}…`
                  : verification.reason || 'Cryptographic signature mismatch. Database record may have been altered.'}
              </small>
            </div>
          </div>
          {!verification.valid && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="button secondary"
                style={{ background: '#dc2626', color: '#fff', border: 0, fontWeight: 700 }}
                onClick={() => deleteTamperedRecord(failedSeq)}
              >
                🗑️ Delete Record #{failedSeq}
              </button>
              <Button onClick={repairChain} disabled={busy}>
                Auto-Repair & Re-Sign Chain
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Subtab navigation */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
        <button
          className={`button ${subTab === 'audit' ? 'primary' : 'ghost'}`}
          onClick={() => setSubTab('audit')}
          style={{ borderRadius: 20 }}
        >
          <ShieldCheck size={16} /> Audit Event Ledger ({rows.length})
        </button>
        <button
          className={`button ${subTab === 'orders' ? 'primary' : 'ghost'}`}
          onClick={() => setSubTab('orders')}
          style={{ borderRadius: 20 }}
        >
          <FileCheck2 size={16} /> Handoff & Recent Orders Audit ({indents.length})
        </button>
      </div>

      {/* Audit Event Ledger Subtab */}
      {subTab === 'audit' && (
        <section className="panel">
          <div className="panel-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3>
                FHIR AuditEvent Ledger <span className="count">{filteredRows.length}</span>
              </h3>
              <p>Tamper-proof HMAC-SHA256 signature chain of all patient medication actions.</p>
            </div>

            {/* Filter buttons for Auditor */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Filter size={15} style={{ color: '#64748b' }} />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                style={{ fontSize: 13, padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}
              >
                <option value="all">All Events ({rows.length})</option>
                <option value="mismatched">⚠️ Mismatched / Tampered Only</option>
                <option value="valid">✓ Verified Intact Only</option>
              </select>
            </div>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>SEQ #</th>
                  <th>EVENT ACTION</th>
                  <th>AGENT (USER)</th>
                  <th>RECORDED AT</th>
                  <th>OUTCOME</th>
                  <th>HMAC SIGNATURE HASH</th>
                  <th>DETAILS</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const isMismatched = !verification?.valid && (r.seq === failedSeq || r._id === verification?.failedRecord?._id);
                  return (
                    <tr
                      key={r._id}
                      style={{
                        background: isMismatched ? '#fef2f2' : undefined,
                        borderLeft: isMismatched ? '4px solid #dc2626' : undefined
                      }}
                      onClick={() => setSelectedAudit(r)}
                    >
                      <td className="mono" style={{ fontWeight: 700 }}>
                        #{String(r.seq).padStart(4, '0')}
                        {isMismatched && (
                          <span style={{ display: 'block', fontSize: 10, color: '#dc2626', fontWeight: 800 }}>
                            MISMATCH
                          </span>
                        )}
                      </td>
                      <td>
                        {renderEventBadge(r.event.subtype[0]?.code)}
                        <small className="block muted mono" style={{ fontSize: 11, marginTop: 4 }}>
                          Action: {r.event.action}
                        </small>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>
                          {r.event.agent[0]?.who?.identifier?.value || 'System'}
                        </span>
                      </td>
                      <td className="nowrap">{dateTime(r.event.recorded)}</td>
                      <td>
                        <span className={`badge ${r.event.outcome === '0' ? 'status-received' : 'status-cancelled'}`}>
                          {r.event.outcome === '0' ? 'Success (200)' : 'Rejected (400)'}
                        </span>
                        {isMismatched && (
                          <span
                            className="badge"
                            style={{
                              background: '#fef2f2',
                              color: '#dc2626',
                              border: '1px solid #fca5a5',
                              marginTop: 4,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 10,
                              fontWeight: 700
                            }}
                          >
                            <AlertTriangle size={11} /> TAMPERED SIGNATURE
                          </span>
                        )}
                      </td>
                      <td className="mono" style={{ fontSize: 11, color: isMismatched ? '#dc2626' : '#64748b', fontWeight: isMismatched ? 700 : 400 }}>
                        {r.hash.slice(0, 16)}…
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <Button kind="ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => setSelectedAudit(r)}>
                            View Details <ChevronRight size={14} />
                          </Button>
                          {isMismatched && (
                            <button
                              className="button secondary"
                              style={{ padding: '4px 8px', fontSize: 11, background: '#dc2626', color: '#fff', border: 0 }}
                              onClick={() => deleteTamperedRecord(r.seq)}
                            >
                              🗑️ Delete & Repair
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Recent Orders Subtab */}
      {subTab === 'orders' && (
        <WorklistTable
          rows={indents}
          onOpen={(item) => setSelectedIndent(item)}
          search={search}
          setSearch={setSearch}
          filter={filter}
          setFilter={setFilter}
          user={{ role: 'auditor', floors: ['ipd-3'] }}
          onNew={() => {}}
          t={t}
        />
      )}

      {selectedIndent && (
        <OrderDetailModal
          key={selectedIndent._id}
          item={selectedIndent}
          user={{ role: 'auditor', floors: ['ipd-3'] }}
          config={{ integrationMode: 'demo', couriers: [] }}
          t={t}
          onClose={() => setSelectedIndent(null)}
          onChanged={refresh}
        />
      )}

      {/* Selected AuditEvent Detail Modal */}
      {selectedAudit && (
        <Modal
          wide
          title={`FHIR AuditEvent #${String(selectedAudit.seq).padStart(4, '0')}`}
          subtitle={`Immutable audit record logged at ${dateTime(selectedAudit.event.recorded)}`}
          onClose={() => setSelectedAudit(null)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {verification &&
              !verification.valid &&
              (selectedAudit.seq === (verification.failedAt || 1) ||
                selectedAudit._id === verification.failedRecord?._id ||
                selectedAudit.seq === verification.failedRecord?.seq) && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fca5a5',
                    borderRadius: 8,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <strong style={{ color: '#dc2626', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <AlertTriangle size={20} /> Cryptographic Signature Verification Failed
                    </strong>
                    <span className="badge" style={{ background: '#dc2626', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                      RECORD #{selectedAudit.seq} TAMPERED
                    </span>
                  </div>

                  <div style={{ fontSize: 13, color: '#991b1b', background: '#ffffff', padding: 12, borderRadius: 6, border: '1px solid #fecaca' }}>
                    <strong style={{ display: 'block', color: '#b91c1c', marginBottom: 4 }}>WHY VERIFICATION FAILED (কারণ):</strong>
                    <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>
                      {verification.reason ||
                        'The HMAC-SHA256 cryptographic signature calculated from the canonical JSON body does not match the stored hash in the database.'}
                    </p>
                    {verification.expectedHash && (
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 11,
                          fontFamily: 'monospace',
                          background: '#0f172a',
                          padding: 10,
                          borderRadius: 6,
                          color: '#f8fafc',
                          wordBreak: 'break-all'
                        }}
                      >
                        <div style={{ color: '#4ade80', marginBottom: 4 }}>
                          <strong>EXPECTED SIGNATURE (Calculated):</strong> {verification.expectedHash}
                        </div>
                        <div style={{ color: '#f87171' }}>
                          <strong>STORED SIGNATURE (In Database):</strong> {verification.actualHash || selectedAudit.hash}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                    <button
                      className="button secondary"
                      style={{ padding: '8px 16px', fontSize: 13, background: '#dc2626', color: '#fff', border: 0, fontWeight: 700 }}
                      onClick={() => deleteTamperedRecord(selectedAudit.seq)}
                    >
                      🗑️ Delete Record #{selectedAudit.seq} & Repair Chain
                    </button>
                    <button
                      className="button secondary"
                      style={{ padding: '8px 16px', fontSize: 13, background: '#0284c7', color: '#fff', border: 0, fontWeight: 700 }}
                      onClick={repairChain}
                    >
                      🛠️ Auto-Repair & Re-Sign Chain
                    </button>
                  </div>
                </div>
              )}

            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <strong style={{ fontSize: 14, color: '#047857' }}>📋 4-Pillar Connected Healthcare References (HIPAA Compliance Rule)</strong>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
                <div>
                  <span style={{ color: '#64748b', fontWeight: 700, display: 'block' }}>1. INDENT SOURCE:</span>
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>Floor Nurse / Ward Assignment · ORC-12 Identifier</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontWeight: 700, display: 'block' }}>2. SUBJECT (PATIENT REF & LOCATION):</span>
                  <span style={{ color: '#0284c7', fontWeight: 600 }}>Patient Reference (Patient/demo-patient-01) · Room 402 / Bed B</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontWeight: 700, display: 'block' }}>3. FULFILLMENT (PHARMACY EVENT):</span>
                  <span style={{ color: '#7c3aed', fontWeight: 600 }}>RxNorm Concept (274783) · FHIR MedicationDispense Event</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontWeight: 700, display: 'block' }}>4. AUDIT STATUS & PROOF:</span>
                  <span style={{ color: '#059669', fontWeight: 600 }}>Pipeline Status 200 · Cryptographic HMAC-SHA256 Proof</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}>
              <div>
                <small style={{ fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block' }}>SEQUENCE & EVENT</small>
                <strong>#{selectedAudit.seq} · {selectedAudit.event.subtype[0]?.code}</strong>
              </div>
              <div>
                <small style={{ fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block' }}>ACTOR (AGENT)</small>
                <strong>{selectedAudit.event.agent[0]?.who?.identifier?.value}</strong>
              </div>
              <div>
                <small style={{ fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block' }}>TARGET ENTITY</small>
                <strong>{selectedAudit.event.entity?.[0]?.what?.identifier?.value || 'System Resource'}</strong>
              </div>
              <div>
                <small style={{ fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block' }}>RECORDED TIME</small>
                <strong>{dateTime(selectedAudit.event.recorded)}</strong>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <small style={{ fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block' }}>HMAC-SHA256 SIGNATURE</small>
                <code style={{ fontSize: 12, wordBreak: 'break-all', background: '#0f172a', color: '#38bdf8', padding: '4px 8px', borderRadius: 4, display: 'block', marginTop: 4 }}>
                  {selectedAudit.hash}
                </code>
              </div>
            </div>

            <details open className="resource">
              <summary>Structured FHIR R4 AuditEvent JSON</summary>
              <pre>{JSON.stringify(selectedAudit.event, null, 2)}</pre>
            </details>

            <div className="modal-actions">
              <Button kind="secondary" onClick={() => setSelectedAudit(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {showCertModal && (
        <AuditCertificateModal
          verification={verification}
          totalCount={rows.length}
          onClose={() => setShowCertModal(false)}
          t={t}
        />
      )}
    </>
  );
}

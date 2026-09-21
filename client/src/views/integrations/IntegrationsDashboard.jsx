import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../../api';
import { Button } from '../../components/ui/Button';
import { ErrorBox } from '../../components/ui/ErrorBox';
import { EmptyState } from '../../components/ui/EmptyState';
import { dateTime } from '../../utils/formatters';

export function IntegrationsDashboard() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  async function refresh() {
    try {
      setRows(await api('/integrations'));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 7000);
    return () => clearInterval(id);
  }, []);

  async function retry(id) {
    try {
      await api('/integrations/' + id + '/retry', { method: 'POST' });
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  const filtered = rows.filter((r) => {
    if (filter === 'all') return true;
    if (filter === 'dispense') return r.kind === 'dispense';
    if (filter === 'webpush') return r.kind === 'webpush';
    if (filter === 'audit') return r.kind === 'audit';
    return true;
  });

  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">CONNECTED SYSTEMS</div>
          <h1>Integration queue</h1>
          <p>Persistent delivery queue for EHR chart updates and nurse mobile alerts.</p>
        </div>
        <Button kind="secondary" onClick={refresh}>
          <RefreshCw size={16} /> Refresh Queue
        </Button>
      </div>

      <ErrorBox>{error}</ErrorBox>

      <section className="panel">
        <div
          className="panel-top"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <h3>
              Active System Jobs <span className="count">{filtered.length}</span>
            </h3>
            <p>EHR MedicationDispense writes and HIPAA mobile pager alerts.</p>
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ width: 240 }}
          >
            <option value="all">All Destination Types</option>
            <option value="dispense">FHIR MedicationDispense (EHR)</option>
            <option value="webpush">Web Push Mobile Alerts</option>
            <option value="audit">FHIR AuditEvent Sync</option>
          </select>
        </div>

        {filtered.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>JOB TYPE & DESTINATION</th>
                  <th>STATUS</th>
                  <th>ATTEMPTS</th>
                  <th>CREATED AT</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r._id}>
                    <td>
                      <strong>
                        {r.kind === 'audit'
                          ? 'FHIR AuditEvent'
                          : r.kind === 'dispense'
                          ? 'FHIR MedicationDispense (EHR)'
                          : 'Web Push Mobile Alert'}
                      </strong>
                      <small className="block muted mono">
                        {r._id.slice(0, 24)}…
                      </small>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          r.status === 'done'
                            ? 'status-received'
                            : r.status === 'dead'
                            ? 'status-cancelled'
                            : 'status-packed'
                        }`}
                      >
                        {r.status === 'done'
                          ? 'Completed (200)'
                          : r.status === 'dead'
                          ? 'Failed'
                          : 'Pending Retry'}
                      </span>
                      {r.lastError && (
                        <small className="block muted">{r.lastError}</small>
                      )}
                    </td>
                    <td>{r.attempts}</td>
                    <td className="nowrap">{dateTime(r.createdAt)}</td>
                    <td>
                      {r.status === 'dead' && (
                        <Button kind="secondary" onClick={() => retry(r._id)}>
                          Retry Job
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Queue is clear">
            <p>New EHR chart updates and courier mobile alerts will appear here.</p>
          </EmptyState>
        )}
      </section>
    </>
  );
}

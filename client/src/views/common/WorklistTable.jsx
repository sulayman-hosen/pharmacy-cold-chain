import React from 'react';
import { Search, Plus } from 'lucide-react';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { dateTime, time } from '../../utils/formatters';

export function WorklistTable({
  rows,
  onOpen,
  search,
  setSearch,
  filter,
  setFilter,
  user,
  onNew,
  t
}) {
  const filtered = rows.filter((r) => {
    const matchesSearch =
      r._id.toLowerCase().includes(search.toLowerCase()) ||
      r.patient.toLowerCase().includes(search.toLowerCase()) ||
      r.medication.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === 'all') return true;
    return r.status === filter;
  });

  return (
    <section className="panel">
      <div className="panel-top">
        <div>
          <h3>
            {user.role === 'nurse' ? t.activeFloorIndents : t.dispensingQueue}{' '}
            <span className="count">{filtered.length}</span>
          </h3>
          <p>
            {user.role === 'nurse' ? t.trackWard : t.pharmacistReviewSub}
          </p>
        </div>
        <div className="filters">
          <div className="search-box">
            <Search size={16} />
            <input
              placeholder={t.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">{t.allStatuses}</option>
            <option value="requested">{t.statusRequested}</option>
            <option value="validated">{t.statusValidated}</option>
            <option value="packed">{t.statusPacked}</option>
            <option value="dispatched">{t.statusDispatched}</option>
            <option value="received">{t.statusReceived}</option>
            <option value="cancelled">{t.statusCancelled}</option>
          </select>
        </div>
      </div>

      {filtered.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>INDENT ID</th>
                <th>PATIENT & WARD</th>
                <th>PRESCRIBED FORMULATION</th>
                <th>STATUS</th>
                <th>COLD LOT / CARRIER</th>
                <th>EXPECTED ETA</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r._id} onClick={() => onOpen(r)}>
                  <td className="mono font-semibold">{r._id}</td>
                  <td>
                    <strong>{r.patient}</strong>
                    <small className="block muted">{r.floor.toUpperCase()}</small>
                  </td>
                  <td>
                    <div className="medication-title">{r.medication}</div>
                    <small className="muted">{r.quantity} dose(s)</small>
                  </td>
                  <td>
                    <StatusBadge value={r.status} t={t} />
                  </td>
                  <td>
                    {r.courier ? (
                      <div>
                        <strong>{r.courier}</strong>
                        <small className="block muted mono">{r.lot || 'COLD-LOT-01'}</small>
                      </div>
                    ) : (
                      <span className="quiet">—</span>
                    )}
                  </td>
                  <td className="nowrap">{time(r.expectedArrivalAt)}</td>
                  <td>
                    <Button
                      kind="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(r);
                      }}
                    >
                      {user.role === 'pharmacist' && r.status === 'requested'
                        ? t.reviewAction
                        : user.role === 'nurse' && r.status === 'dispatched'
                        ? t.receiveAction
                        : t.detailsAction}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title={t.noRequestsTitle}>
          <p>{t.noRequestsBody}</p>
          {user.role === 'nurse' && onNew && (
            <Button onClick={onNew}>
              <Plus size={16} />
              {t.newRequest}
            </Button>
          )}
        </EmptyState>
      )}
    </section>
  );
}

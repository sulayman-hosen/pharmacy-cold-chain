import React from 'react';
import { ArrowUpRight, Search, Package, ChevronRight, ClipboardList, RefreshCw, Plus, LockKeyhole } from 'lucide-react';
import { Status, Empty, Button, time } from '../common/UIComponents';

export function Worklist({ rows, onOpen, search, setSearch, filter, setFilter, user, onNew, t }) {
  const filtered = rows.filter(
    (r) =>
      (filter === 'all' || r.status === filter) &&
      `${r.prescriptionId} ${r.validation?.name || ''} ${r._id} ${r.patientRef || ''} ${r.nurseName || ''} ${r.floor || ''} ${r.room || ''} ${r.bed || ''}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  const statusOptions = [
    ['all', t.allStatuses || 'All statuses'],
    ['requested', t.statusRequested || 'Awaiting review'],
    ['validated', t.statusValidated || 'Approved'],
    ['packed', t.statusPacked || 'Packed'],
    ['dispatch-pending', t.statusDispatchPending || 'Chart sync pending'],
    ['dispatched', t.statusDispatched || 'In transit'],
    ['received', t.statusReceived || 'Received'],
    ['cancelled', t.statusCancelled || 'Cancelled']
  ];

  return (
    <section className="panel worklist">
      <div className="panel-top">
        <div>
          <h3>
            {t.medicationRequests} <span className="count">{rows.length}</span>
          </h3>
          <p>{t.everyHandoff || 'Every handoff, from prescription to floor.'}</p>
        </div>
        <button
          className="text-button"
          onClick={() => {
            setFilter('all');
            setSearch('');
          }}
        >
          {t.viewAll || 'View all'} <ArrowUpRight size={15} />
        </button>
      </div>

      <div className="table-tools">
        <div className="search">
          <Search size={16} />
          <input
            aria-label="Search requests"
            placeholder={t.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select aria-label="Filter by status" value={filter} onChange={(e) => setFilter(e.target.value)}>
          {statusOptions.map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t.medicationOrder}</th>
                <th>{t.dose}</th>
                <th>{t.status}</th>
                <th>{t.delivery}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r._id} onClick={() => onOpen(r)}>
                  <td>
                    <div className="drug-cell">
                      <span className="drug-icon">
                        <Package size={18} />
                      </span>
                      <div>
                        <strong>{r.validation.name}</strong>
                        <small>
                          {r.prescriptionId} · {r.floor.toUpperCase()}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td className="nowrap">
                    {r.dose} <span className="muted">{r.unit}</span>
                  </td>
                  <td>
                    <Status value={r.status} t={t} />
                  </td>
                  <td className="nowrap">
                    {r.dispatch ? (
                      <>
                        <strong>{time(r.dispatch.eta)}</strong>
                        <small className="block muted">{r.dispatch.courierId}</small>
                      </>
                    ) : (
                      <span className="muted">{t.notDispatched}</span>
                    )}
                  </td>
                  <td>
                    <button className="icon-button" aria-label={`Open ${r.prescriptionId}`}>
                      <ChevronRight size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          icon={ClipboardList}
          title={rows.length ? t.noMatchingRequests || 'No matching requests' : t.clearStart || 'A clear start for your shift'}
        >
          {rows.length ? (
            <>
              <p>{t.tryAnotherSearch || 'Try another search or status filter.'}</p>
              {(search || filter !== 'all') && (
                <div className="empty-actions">
                  <Button
                    kind="secondary"
                    onClick={() => {
                      setSearch('');
                      setFilter('all');
                    }}
                  >
                    <RefreshCw size={14} /> {t.resetFilters || 'Reset search & filters'}
                  </Button>
                </div>
              )}
            </>
          ) : user.role === 'nurse' ? (
            <>
              <p>Create a request to begin the first delivery.</p>
              <div className="empty-actions">
                <button className="text-button" onClick={onNew}>
                  {t.newRequest} <Plus size={15} />
                </button>
              </div>
            </>
          ) : (
            <p>Requests from floor nurses will appear here for review.</p>
          )}
        </Empty>
      )}

      <div className="table-footer">
        {t.showingCount
          ? t.showingCount.replace('{count}', filtered.length).replace('{total}', rows.length)
          : `Showing ${filtered.length} of ${rows.length} recent requests`}
        <span>
          <LockKeyhole size={12} /> {t.accessLimited || 'Access limited to your assignment'}
        </span>
      </div>
    </section>
  );
}

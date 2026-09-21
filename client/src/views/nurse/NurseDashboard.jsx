import React from 'react';
import {
  ClipboardList,
  Package,
  Truck,
  CheckCircle2,
  RefreshCw,
  Plus,
  ShieldCheck
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { WorklistTable } from '../common/WorklistTable';
import { JourneyTimelineWidget } from '../../components/widgets/JourneyTimelineWidget';
import { PrivacyCardWidget } from '../../components/widgets/PrivacyCardWidget';

export function NurseDashboard({
  tab,
  rows,
  search,
  setSearch,
  filter,
  setFilter,
  user,
  config,
  refreshing,
  refresh,
  onOpenSelected,
  onOpenNewRequest,
  t
}) {
  const pending = rows.filter((r) => r.status === 'requested').length;
  const ready = rows.filter((r) => ['validated', 'packed'].includes(r.status)).length;
  const transit = rows.filter((r) => ['dispatch-pending', 'dispatched'].includes(r.status)).length;
  const received = rows.filter((r) => r.status === 'received').length;

  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">{user.floors.join(' · ').toUpperCase()}</div>
          <h1>{tab === 'overview' ? t.goodCare : t.medicationRequests}</h1>
          <p>{t.nurseSubtitle}</p>
        </div>
        <div className="title-actions">
          <button
            className={`icon-button refresh ${refreshing ? 'spinning' : ''}`}
            onClick={refresh}
            aria-label="Refresh requests"
          >
            <RefreshCw size={18} />
          </button>
          <Button onClick={onOpenNewRequest}>
            <Plus size={17} />
            {t.newRequest}
          </Button>
        </div>
      </div>

      {tab === 'overview' && (
        <>
          <div className="summary-grid">
            {[
              [pending, t.awaitingReview, t.needsPharmacist, ClipboardList, 'amber'],
              [ready, t.preparing, t.approvedOrReady, Package, 'green'],
              [transit, t.onTheWay, t.chartSyncOrTransit, Truck, 'blue'],
              [received, t.received, t.handoffConfirmed, CheckCircle2, 'violet']
            ].map(([number, title, subtitle, Icon, color]) => (
              <div className="metric" key={title}>
                <div className="metric-heading">
                  <span>{title}</span>
                  <span className={`metric-icon ${color}`}>
                    <Icon size={17} />
                  </span>
                </div>
                <strong>{String(number).padStart(2, '0')}</strong>
                <p>{subtitle}</p>
              </div>
            ))}
          </div>

          <div className="care-banner">
            <div>
              <h3>{t.protectJourney}</h3>
              <p>{t.bannerDesc}</p>
            </div>
            <span className="banner-pill">
              <ShieldCheck size={14} /> {t.controlledHandoffs}
            </span>
          </div>
        </>
      )}

      <div className={tab === 'overview' ? 'overview-grid' : ''}>
        <WorklistTable
          rows={rows}
          search={search}
          setSearch={setSearch}
          filter={filter}
          setFilter={setFilter}
          user={user}
          t={t}
          onOpen={onOpenSelected}
          onNew={onOpenNewRequest}
        />

        {tab === 'overview' && (
          <aside className="right-rail">
            <JourneyTimelineWidget t={t} />
            <PrivacyCardWidget t={t} />
          </aside>
        )}
      </div>

      <p className="footnote">
        {config?.integrationMode === 'demo'
          ? 'Demo data and terminology fixtures · No real patient information'
          : 'Strict formulation matching · No automatic medication substitutions'}
        <span>Updated {new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
      </p>
    </>
  );
}

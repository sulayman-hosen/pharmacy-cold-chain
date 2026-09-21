import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import {
  LayoutDashboard,
  Package,
  Truck,
  Bell,
  ShieldCheck,
  Plug,
  ArrowRight,
  Plus,
  RefreshCw,
  LogOut,
  ChevronRight,
  FileCheck2,
  LockKeyhole,
  Activity,
  ClipboardList,
  CheckCircle2,
  Sun,
  Moon,
  Globe,
  BarChart2
} from 'lucide-react';
import { api, setCsrf, enablePush } from './api';
import { translations } from './translations';
import './styles.css';

import { Mark, Status, Button, ErrorBox, Empty, dateTime, time } from './components/common/UIComponents';
import { Login } from './components/auth/Login';
import { RequestModal } from './components/orders/RequestModal';
import { DetailModal } from './components/orders/DetailModal';
import { Worklist } from './components/orders/Worklist';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { AuditView } from './components/audit/AuditView';
import { IntegrationsView } from './components/integrations/IntegrationsView';

function App() {
  const [user, setUser] = useState(null),
    [boot, setBoot] = useState(true),
    [config, setConfig] = useState(null),
    [tab, setTab] = useState('overview'),
    [rows, setRows] = useState([]),
    [notifications, setNotifications] = useState([]),
    [newRequest, setNew] = useState(false),
    [selected, setSelected] = useState(null),
    [error, setError] = useState(''),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all'),
    [refreshing, setRefreshing] = useState(false);
  const [lang, setLang] = useState('en');
  const [theme, setTheme] = useState('light');
  const t = translations[lang] || translations.en;

  useEffect(() => {
    if (theme === 'dark') document.body.classList.add('dark-theme');
    else document.body.classList.remove('dark-theme');
  }, [theme]);

  useEffect(() => {
    api('/auth/me')
      .then((d) => {
        setCsrf(d.csrf);
        setUser(d.user);
      })
      .catch(() => {})
      .finally(() => setBoot(false));
  }, []);
  useEffect(() => {
    if (user) {
      setTab(user.role === 'auditor' ? 'audit' : 'overview');
      api('/config')
        .then(setConfig)
        .catch((e) => setError(e.message));
    }
  }, [user]);
  const refresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      setRows(await api('/indents'));
      if (user.role === 'nurse') setNotifications(await api('/notifications'));
      setError('');
    } catch (e) {
      if (e.status === 401) {
        setUser(null);
        setConfig(null);
      } else setError(e.message);
    } finally {
      setRefreshing(false);
    }
  }, [user]);
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [refresh]);
  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST' });
      setCsrf('');
      setUser(null);
      setConfig(null);
      setRows([]);
      setNotifications([]);
      setSelected(null);
    } catch (e) {
      setError(e.message);
    }
  }

  if (boot)
    return (
      <div className="boot">
        <Mark />
        <p>Connecting your workspace…</p>
      </div>
    );
  if (!user) return <Login onLogin={setUser} t={t} />;
  if (!config)
    return (
      <div className="boot">
        <Mark />
        <p>Preparing your workspace…</p>
        <ErrorBox>{error}</ErrorBox>
        <Button onClick={logout}>{t.signOut}</Button>
      </div>
    );

  const tabs =
    user.role === 'auditor'
      ? [
          ['audit', t.audit, ShieldCheck],
          ['integrations', t.integrations, Plug],
          ['analytics', t.analytics || 'Analytics', BarChart2]
        ]
      : [
          ['overview', t.overview, LayoutDashboard],
          ['requests', t.requests, ClipboardList],
          ['analytics', t.analytics || 'Analytics', BarChart2],
          ...(user.role === 'nurse' ? [['inbox', t.inbox, Bell]] : []),
          ...(user.role === 'pharmacist' ? [['integrations', t.integrations, Plug]] : [])
        ];
  const pending = rows.filter((r) => r.status === 'requested').length,
    ready = rows.filter((r) => ['validated', 'packed'].includes(r.status)).length,
    transit = rows.filter((r) => ['dispatch-pending', 'dispatched'].includes(r.status)).length,
    received = rows.filter((r) => r.status === 'received').length;
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Mark />
          <span>
            COLDLINE<span className="brand-period">.</span>
          </span>
        </div>
        <div className="workspace-label">{t.brandSubtitle}</div>
        <nav>
          {tabs.map(([id, label, Icon]) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
              <Icon size={19} />
              {label}
              {id === 'inbox' && unread > 0 && <span className="nav-number">{unread}</span>}
              {id === 'requests' && pending > 0 && <span className="nav-number">{pending}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="connection">
            <span className="dot" />
            <div>
              <strong>Pharmacy ↔ IPD</strong>
              <small>{config.integrationMode === 'demo' ? 'Synthetic demo environment' : 'Connected · FHIR R4'}</small>
            </div>
          </div>
          <div className="profile">
            <span className="avatar">{user.role.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{user.name.split(' · ')[0]}</strong>
              <small>{user.role}</small>
            </div>
            <button className="icon-button" title="Sign out" aria-label="Sign out" onClick={logout}>
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <strong>{tabs.find((t) => t[0] === tab)?.[1]}</strong>
          </div>
          <div className="topbar-right">
            <button className="icon-button lang-toggle" title="Switch Language" onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}>
              <Globe size={18} />
              <span className="lang-text">{lang === 'en' ? 'BN' : 'EN'}</span>
            </button>
            <button
              className="icon-button theme-toggle"
              title="Toggle Theme"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <span className="environment">
              <span className="dot" />
              {config.integrationMode === 'demo' ? 'Demo mode' : 'Live integrations'}
            </span>
            <span className="topbar-date">
              {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            {user.role === 'nurse' && (
              <button className="icon-button notification-button" aria-label="Open notifications" onClick={() => setTab('inbox')}>
                <Bell size={19} />
                {unread > 0 && <i />}
              </button>
            )}
          </div>
        </header>
        <main>
          <ErrorBox>{error}</ErrorBox>
          {(tab === 'overview' || tab === 'requests') && (
            <>
              <div className="page-title">
                <div>
                  <div className="eyebrow">{user.role === 'nurse' ? user.floors.join(' · ').toUpperCase() : 'PHARMACY OPERATIONS'}</div>
                  <h1>{tab === 'overview' ? t.goodCare : t.medicationRequests}</h1>
                  <p>{user.role === 'nurse' ? t.nurseSubtitle : t.pharmacySubtitle}</p>
                </div>
                <div className="title-actions">
                  <button className={`icon-button refresh ${refreshing ? 'spinning' : ''}`} onClick={refresh} aria-label="Refresh requests">
                    <RefreshCw size={18} />
                  </button>
                  {user.role === 'nurse' && (
                    <Button onClick={() => setNew(true)}>
                      <Plus size={17} />
                      {t.newRequest}
                    </Button>
                  )}
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
                <Worklist {...{ rows, search, setSearch, filter, setFilter, user, t }} onOpen={setSelected} onNew={() => setNew(true)} />
                {tab === 'overview' && (
                  <aside className="right-rail">
                    <section className="panel flow-panel">
                      <div className="panel-top">
                        <div>
                          <h3>{t.deliveryJourney}</h3>
                          <p>{t.connectedPath}</p>
                        </div>
                        <Activity size={18} />
                      </div>
                      <div className="journey">
                        {[
                          [FileCheck2, t.prescriptionCheck, t.readActiveFhir],
                          [ShieldCheck, t.formulationMatch, t.verifyDrugDose],
                          [Package, t.protectedPacking, t.recordTempLot],
                          [Truck, t.courierDeparture, t.updateChartNotify]
                        ].map(([Icon, title, description], i) => (
                          <div key={title} className="journey-step">
                            <span>
                              <Icon size={17} />
                            </span>
                            <div>
                              <strong>{title}</strong>
                              <p>{description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                    <section className="privacy-card">
                      <span className="privacy-icon">
                        <LockKeyhole size={21} />
                      </span>
                      <h3>{t.privateByDesign}</h3>
                      <p>{t.privateDesc}</p>
                      <div className="notification-preview">
                        <div>
                          <strong>COLDLINE</strong>
                          <small>Preview</small>
                        </div>
                        <b>Delivery update</b>
                        <p>
                          Courier 07 is on the way.
                          <br />
                          Open Coldline for details.
                        </p>
                      </div>
                    </section>
                  </aside>
                )}
              </div>
              <p className="footnote">
                {config.integrationMode === 'demo'
                  ? 'Demo data and terminology fixtures · No real patient information'
                  : 'Strict formulation matching · No automatic medication substitutions'}
                <span>Updated {new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
              </p>
            </>
          )}
          {tab === 'inbox' && (
            <>
              <div className="page-title">
                <div>
                  <div className="eyebrow">{t.deliveryUpdatesEyebrow || 'YOUR DELIVERY UPDATES'}</div>
                  <h1>{t.notificationsTitle || 'My notifications'}</h1>
                  <p>{t.notificationsSub || 'Safe to show on a lock screen. Open requests for patient details.'}</p>
                </div>
                {config.pushEnabled && (
                  <Button kind="secondary" onClick={() => enablePush(config.vapidPublicKey).catch((e) => setError(e.message))}>
                    <Bell size={16} />
                    {t.enablePhoneAlerts || 'Enable phone alerts'}
                  </Button>
                )}
              </div>
              <section className="panel inbox-list">
                {notifications.length ? (
                  notifications.map((n) => {
                    const isBn = lang === 'bn';
                    const displayTitle =
                      isBn && n.payload?.title === 'Delivery update' ? 'ডেলিভারি আপডেট' : n.payload?.title || 'Delivery update';
                    let displayBody = n.payload?.body || '';
                    if (isBn && (displayBody.includes('is on the way.') || displayBody.includes('refrigerator'))) {
                      displayBody = displayBody
                        .replace('is on the way.', 'রওনা দিয়েছেন।')
                        .replace('ETA', 'পৌঁছানোর সময় (ETA):')
                        .replace('Please place in refrigerator upon receipt.', 'ওষুধ আসামাত্র ফ্রিজে রাখুন।')
                        .replace('Open Coldline for details.', 'ওষুধ আসামাত্র ফ্রিজে রাখুন।');
                    }
                    return (
                      <article key={n._id} className={n.readAt ? 'read' : ''}>
                        <span className="inbox-icon">
                          <Truck size={22} />
                        </span>
                        <div>
                          <h3>
                            {displayTitle}
                            {!n.readAt && <span className="unread-dot" />}
                          </h3>
                          <p>{displayBody}</p>
                          <small>{dateTime(n.createdAt)}</small>
                        </div>
                        <Button
                          kind="ghost"
                          onClick={async () => {
                            await api('/notifications/' + n._id + '/read', { method: 'POST' });
                            await refresh();
                            setTab('requests');
                          }}
                        >
                          {t.openWorkspace || 'Open workspace'} <ArrowRight size={15} />
                        </Button>
                      </article>
                    );
                  })
                ) : (
                  <Empty icon={Bell} title={t.caughtUpTitle || 'You’re all caught up'}>
                    <p>{t.caughtUpBody || 'Delivery updates arrive here after the chart is updated.'}</p>
                  </Empty>
                )}
              </section>
              {!config.pushEnabled && (
                <p className="footnote">
                  {t.inappFootnote ||
                    'In-app alerts are active. Add VAPID credentials in the server configuration to enable real Web Push.'}
                </p>
              )}
            </>
          )}
          {tab === 'analytics' && <AnalyticsView rows={rows} t={t} />}
          {tab === 'audit' && <AuditView t={t} />}
          {tab === 'integrations' && <IntegrationsView />}
        </main>
        <footer className="app-footer">
          <span>
            COLDLINE. <span>Care in every connection.</span>
          </span>
          <span>PHARMACY TO FLOOR</span>
        </footer>
      </div>
      {newRequest && <RequestModal config={config} user={user} onClose={() => setNew(false)} onCreated={() => { setNew(false); refresh(); }} />}
      {selected && <DetailModal key={selected._id} item={selected} user={user} config={config} t={t} onClose={() => setSelected(null)} onChanged={refresh} />}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);

import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  Bell,
  ShieldCheck,
  Plug,
  ClipboardList,
  BarChart2
} from 'lucide-react';
import { api, setCsrf } from './api';
import { translations } from './translations';
import { BrandMark } from './components/ui/BrandMark';
import { Button } from './components/ui/Button';
import { ErrorBox } from './components/ui/ErrorBox';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { LoginView } from './views/auth/LoginView';
import { NurseDashboard } from './views/nurse/NurseDashboard';
import { NurseInboxView } from './views/nurse/NurseInboxView';
import { PharmacistDashboard } from './views/pharmacist/PharmacistDashboard';
import { AuditorDashboard } from './views/auditor/AuditorDashboard';
import { AnalyticsDashboard } from './views/analytics/AnalyticsDashboard';
import { IntegrationsDashboard } from './views/integrations/IntegrationsDashboard';
import { RequestMedicationModal } from './components/modals/RequestMedicationModal';
import { OrderDetailModal } from './components/modals/OrderDetailModal';

export function App() {
  const [user, setUser] = useState(null);
  const [boot, setBoot] = useState(true);
  const [config, setConfig] = useState(null);
  const [tab, setTab] = useState('overview');
  const [rows, setRows] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [newRequest, setNew] = useState(false);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
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
      } else {
        setError(e.message);
      }
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

  if (boot) {
    return (
      <div className="boot">
        <BrandMark />
        <p>Connecting your workspace…</p>
      </div>
    );
  }

  if (!user) return <LoginView onLogin={setUser} t={t} />;

  if (!config) {
    return (
      <div className="boot">
        <BrandMark />
        <p>Preparing your workspace…</p>
        <ErrorBox>{error}</ErrorBox>
        <Button onClick={logout}>{t.signOut}</Button>
      </div>
    );
  }

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

  const pending = rows.filter((r) => r.status === 'requested').length;
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="app-shell">
      <Sidebar
        user={user}
        config={config}
        tab={tab}
        setTab={setTab}
        tabs={tabs}
        unread={unread}
        pending={pending}
        logout={logout}
        t={t}
      />

      <div className="main-column">
        <Header
          tab={tab}
          tabs={tabs}
          user={user}
          config={config}
          lang={lang}
          setLang={setLang}
          theme={theme}
          setTheme={setTheme}
          unread={unread}
          onOpenInbox={() => setTab('inbox')}
        />

        <main>
          <ErrorBox>{error}</ErrorBox>

          {/* Nurse specific overview & requests */}
          {user.role === 'nurse' && (tab === 'overview' || tab === 'requests') && (
            <NurseDashboard
              tab={tab}
              rows={rows}
              search={search}
              setSearch={setSearch}
              filter={filter}
              setFilter={setFilter}
              user={user}
              config={config}
              refreshing={refreshing}
              refresh={refresh}
              onOpenSelected={setSelected}
              onOpenNewRequest={() => setNew(true)}
              t={t}
            />
          )}

          {/* Nurse inbox / notifications */}
          {user.role === 'nurse' && tab === 'inbox' && (
            <NurseInboxView
              notifications={notifications}
              config={config}
              lang={lang}
              refresh={refresh}
              setTab={setTab}
              setError={setError}
              t={t}
            />
          )}

          {/* Pharmacist specific overview & requests */}
          {user.role === 'pharmacist' && (tab === 'overview' || tab === 'requests') && (
            <PharmacistDashboard
              tab={tab}
              rows={rows}
              search={search}
              setSearch={setSearch}
              filter={filter}
              setFilter={setFilter}
              user={user}
              config={config}
              refreshing={refreshing}
              refresh={refresh}
              onOpenSelected={setSelected}
              t={t}
            />
          )}

          {/* Auditor specific views */}
          {tab === 'audit' && <AuditorDashboard t={t} />}

          {/* Analytics view */}
          {tab === 'analytics' && <AnalyticsDashboard rows={rows} t={t} />}

          {/* Integrations view */}
          {tab === 'integrations' && <IntegrationsDashboard />}
        </main>

        <footer className="app-footer">
          <span>
            COLDLINE. <span>Care in every connection.</span>
          </span>
          <span>PHARMACY TO FLOOR</span>
        </footer>
      </div>

      {newRequest && (
        <RequestMedicationModal
          config={config}
          user={user}
          onClose={() => setNew(false)}
          onCreated={() => {
            setNew(false);
            refresh();
          }}
        />
      )}

      {selected && (
        <OrderDetailModal
          key={selected._id}
          item={selected}
          user={user}
          config={config}
          t={t}
          onClose={() => setSelected(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

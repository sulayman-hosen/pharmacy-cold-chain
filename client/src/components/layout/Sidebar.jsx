import React from 'react';
import { LogOut } from 'lucide-react';
import { BrandMark } from '../ui/BrandMark';

export function Sidebar({
  user,
  config,
  tab,
  setTab,
  tabs,
  unread,
  pending,
  logout,
  t
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <BrandMark />
        <span>
          COLDLINE<span className="brand-period">.</span>
        </span>
      </div>
      <div className="workspace-label">{t.brandSubtitle}</div>
      <nav>
        {tabs.map(([id, label, Icon]) => (
          <button
            key={id}
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
          >
            <Icon size={19} />
            {label}
            {id === 'inbox' && unread > 0 && (
              <span className="nav-number">{unread}</span>
            )}
            {id === 'requests' && pending > 0 && (
              <span className="nav-number">{pending}</span>
            )}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="connection">
          <span className="dot" />
          <div>
            <strong>Pharmacy ↔ IPD</strong>
            <small>
              {config?.integrationMode === 'demo'
                ? 'Synthetic demo environment'
                : 'Connected · FHIR R4'}
            </small>
          </div>
        </div>
        <div className="profile">
          <span className="avatar">
            {user?.role?.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{user?.name?.split(' · ')[0]}</strong>
            <small>{user?.role}</small>
          </div>
          <button
            className="icon-button"
            title="Sign out"
            aria-label="Sign out"
            onClick={logout}
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </aside>
  );
}

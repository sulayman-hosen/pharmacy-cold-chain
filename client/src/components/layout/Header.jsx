import React from 'react';
import { ChevronRight, Globe, Moon, Sun, Bell } from 'lucide-react';

export function Header({
  tab,
  tabs,
  user,
  config,
  lang,
  setLang,
  theme,
  setTheme,
  unread,
  onOpenInbox
}) {
  return (
    <header className="topbar">
      <div className="breadcrumb">
        Workspace <ChevronRight size={13} />
        <strong>{tabs.find((t) => t[0] === tab)?.[1]}</strong>
      </div>
      <div className="topbar-right">
        <button
          className="icon-button lang-toggle"
          title="Switch Language"
          onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
        >
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
          {config?.integrationMode === 'demo' ? 'Demo mode' : 'Live integrations'}
        </span>
        <span className="topbar-date">
          {new Date().toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })}
        </span>
        {user?.role === 'nurse' && (
          <button
            className="icon-button notification-button"
            aria-label="Open notifications"
            onClick={onOpenInbox}
          >
            <Bell size={19} />
            {unread > 0 && <i />}
          </button>
        )}
      </div>
    </header>
  );
}

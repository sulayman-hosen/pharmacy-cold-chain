import React, { useState } from 'react';
import { FileCheck2, ShieldCheck, Truck, ArrowRight, LockKeyhole } from 'lucide-react';
import { api, setCsrf } from '../../api';
import { Mark, Button, ErrorBox } from '../common/UIComponents';

export function Login({ onLogin, t }) {
  const [username, setUsername] = useState('nurse');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api('/auth/login', { method: 'POST', body: { username, password } });
      setCsrf(data.csrf);
      onLogin(data.user);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <section className="login-story">
        <div className="brand">
          <Mark />
          <span>
            COLDLINE<span className="brand-period">.</span>
          </span>
        </div>
        <div className="story-body">
          <div className="eyebrow light">
            <span className="dot" /> PHARMACY → INPATIENT CARE
          </div>
          <h1>
            A careful handoff.
            <br />
            <span>Every time.</span>
          </h1>
          <p>From a verified prescription to the right floor. Keep every cold-chain delivery connected, accountable, and protected.</p>
          <div className="story-flow">
            <div>
              <FileCheck2 />
              <span>Verify</span>
            </div>
            <i />
            <div>
              <ShieldCheck />
              <span>Protect</span>
            </div>
            <i />
            <div>
              <Truck />
              <span>Deliver</span>
            </div>
          </div>
        </div>
        <div className="story-footer">
          <ShieldCheck size={17} /> Private alerts. Traceable handoffs.
        </div>
      </section>
      <section className="login-form">
        <div className="login-inner">
          <div className="eyebrow">YOUR WORKSPACE, CONNECTED</div>
          <h2>{t.welcome}</h2>
          <p className="muted">{t.signInSubtitle}</p>
          <form onSubmit={submit}>
            <label>
              {t.username}
              <input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </label>
            <label>
              {t.password}
              <input autoComplete="current-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            <ErrorBox>{error}</ErrorBox>
            <Button disabled={busy}>
              {busy ? t.signingIn : t.signInBtn}
              <ArrowRight size={17} />
            </Button>
          </form>
          <small className="muted">{t.softwareDemo}</small>
        </div>
      </section>
    </div>
  );
}

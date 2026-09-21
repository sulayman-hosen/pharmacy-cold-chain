import React, { useState } from 'react';
import { api, setCsrf } from '../../api';
import { BrandMark } from '../../components/ui/BrandMark';
import { Button } from '../../components/ui/Button';
import { ErrorBox } from '../../components/ui/ErrorBox';

export function LoginView({ onLogin, t }) {
  const [role, setRole] = useState('nurse');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api('/auth/login', {
        method: 'POST',
        body: { role, password }
      });
      setCsrf(res.csrf);
      onLogin(res.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function demoLogin(selectedRole) {
    setRole(selectedRole);
    setPassword('Demo-Password123!');
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <BrandMark />
          <div>
            <h1>COLDLINE</h1>
            <p>{t?.brandSubtitle || 'Pharmacy-to-Floor Cold Chain Management'}</p>
          </div>
        </div>

        <form onSubmit={submit} className="login-form">
          <ErrorBox>{error}</ErrorBox>

          <label>
            <span>Select Workspace Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="nurse">Nurse (Floor Request & Handoff)</option>
              <option value="pharmacist">Pharmacist (Validation & Packing)</option>
              <option value="auditor">Auditor (Ledger Verification)</option>
            </select>
          </label>

          <label>
            <span>Passcode / Password</span>
            <input
              type="password"
              placeholder="Enter demo passcode"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <Button type="submit" disabled={busy}>
            {busy ? 'Authenticating…' : 'Sign in to Workspace'}
          </Button>

          <div className="demo-shortcuts">
            <small>Quick demo shortcuts:</small>
            <div className="shortcut-buttons">
              <button type="button" onClick={() => demoLogin('nurse')}>
                Nurse
              </button>
              <button type="button" onClick={() => demoLogin('pharmacist')}>
                Pharmacist
              </button>
              <button type="button" onClick={() => demoLogin('auditor')}>
                Auditor
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

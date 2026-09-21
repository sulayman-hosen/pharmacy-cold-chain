import React from 'react';
import { LockKeyhole } from 'lucide-react';

export function PrivacyCardWidget({ t }) {
  return (
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
  );
}

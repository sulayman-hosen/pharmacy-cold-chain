import React, { useState } from 'react';
import { QrCode, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { playExcursionBeep } from '../../utils/formatters';

export function QrHandoffWidget({ lot, onConfirm, busy, t }) {
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);

  function scan() {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      setScanned(true);
      playExcursionBeep();
    }, 1400);
  }

  return (
    <div className="qr-card">
      <div className="qr-head">
        <QrCode size={22} />
        <div>
          <strong>QR Handoff Scan</strong>
          <small>Verify Lot: {lot || 'COLD-LOT-01'}</small>
        </div>
      </div>
      {!scanned ? (
        <Button kind="secondary" disabled={scanning} onClick={scan}>
          {scanning ? 'Scanning QR tag…' : '📷 Scan Delivery Box QR Code'}
        </Button>
      ) : (
        <div className="scanned-success">
          <span className="badge status-received">
            <CheckCircle2 size={15} /> QR Code Verified
          </span>
          <Button disabled={busy} onClick={onConfirm}>
            {t?.confirmReceipt || 'Confirm Receipt'}
          </Button>
        </div>
      )}
    </div>
  );
}

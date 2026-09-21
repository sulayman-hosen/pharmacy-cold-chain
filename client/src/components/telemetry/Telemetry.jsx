import React, { useState, useEffect } from 'react';
import { Thermometer, QrCode, CheckCircle2 } from 'lucide-react';
import { Button } from '../common/UIComponents';

export function playExcursionBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {}
}

export function TemperatureTelemetry({ packedTemp = 4 }) {
  const readings = [
    { time: '00:00', temp: Number(packedTemp).toFixed(1) },
    { time: '00:05', temp: (Number(packedTemp) + 0.3).toFixed(1) },
    { time: '00:10', temp: (Number(packedTemp) + 0.5).toFixed(1) },
    { time: '00:15', temp: (Number(packedTemp) + 0.2).toFixed(1) },
    { time: '00:20', temp: (Number(packedTemp) + 0.4).toFixed(1) }
  ];
  const maxTemp = Math.max(...readings.map(r => Number(r.temp)));
  const minTemp = Math.min(...readings.map(r => Number(r.temp)));
  const isExcursion = maxTemp > 8.0 || minTemp < 2.0;

  useEffect(() => {
    if (isExcursion) playExcursionBeep();
  }, [isExcursion]);

  return (
    <div className="telemetry-card">
      <div className="telemetry-head">
        <div>
          <strong className="telemetry-title"><Thermometer size={16} /> IoT Transit Telemetry (2°C – 8°C)</strong>
          <small className="telemetry-sub">Live sensor data feed</small>
        </div>
        <span className={`telemetry-badge ${isExcursion ? 'excursion excursion-flash' : 'safe'}`}>
          {isExcursion ? '⚠️ Temp Excursion' : '✓ Safe Cold-Chain'}
        </span>
      </div>
      <div className="telemetry-bars">
        {readings.map((r, i) => (
          <div key={i} className="bar-col">
            <span className="bar-val">{r.temp}°C</span>
            <div className="bar-bg">
              <div className={`bar-fill ${Number(r.temp) > 8 || Number(r.temp) < 2 ? 'fill-danger' : ''}`} style={{ height: `${Math.min(100, Math.max(25, (Number(r.temp) / 10) * 100))}%` }} />
            </div>
            <span className="bar-time">{r.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function QrHandoffSection({ lot, onConfirm, busy, t }) {
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
          <strong>{t?.qrScannerTitle || 'Package Barcode Verification'}</strong>
          <small>{t?.qrScannerDesc || `Scan QR code on package to verify Lot #${lot}`}</small>
        </div>
      </div>
      {scanning && (
        <div className="reticle-container">
          <div className="reticle-box">
            <div className="reticle-laser" />
            <QrCode size={42} color="#38bdf8" />
          </div>
          <span className="reticle-text">{t?.reticleScanning || 'Aligning camera & scanning reticle…'}</span>
        </div>
      )}
      {!scanned ? (
        <Button kind="secondary" disabled={scanning || busy} onClick={scan}>
          <QrCode size={16} /> {scanning ? (t?.reticleScanning || 'Scanning camera reticle…') : (t?.simulateScan || 'Simulate Camera Scan')}
        </Button>
      ) : (
        <div className="qr-matched">
          <CheckCircle2 size={18} />
          <span>{t?.verifiedLot || 'Package Barcode Verified:'} Lot #{lot} matches.</span>
          <Button disabled={busy} onClick={onConfirm}>
            <CheckCircle2 size={16} /> Confirm Receipt
          </Button>
        </div>
      )}
    </div>
  );
}

import React, { useEffect } from 'react';
import { Thermometer } from 'lucide-react';
import { playExcursionBeep } from '../../utils/formatters';

export function TelemetryWidget({ packedTemp = 4 }) {
  const readings = [
    { time: '00:00', temp: Number(packedTemp).toFixed(1) },
    { time: '00:05', temp: (Number(packedTemp) + 0.3).toFixed(1) },
    { time: '00:10', temp: (Number(packedTemp) + 0.5).toFixed(1) },
    { time: '00:15', temp: (Number(packedTemp) + 0.2).toFixed(1) },
    { time: '00:20', temp: (Number(packedTemp) + 0.4).toFixed(1) }
  ];
  const maxTemp = Math.max(...readings.map((r) => Number(r.temp)));
  const minTemp = Math.min(...readings.map((r) => Number(r.temp)));
  const isExcursion = maxTemp > 8.0 || minTemp < 2.0;

  useEffect(() => {
    if (isExcursion) playExcursionBeep();
  }, [isExcursion]);

  return (
    <div className="telemetry-card">
      <div className="telemetry-head">
        <div>
          <strong className="telemetry-title">
            <Thermometer size={16} /> IoT Transit Telemetry (2°C – 8°C)
          </strong>
          <small className="telemetry-sub">Live sensor data feed</small>
        </div>
        <span
          className={`telemetry-badge ${
            isExcursion ? 'excursion excursion-flash' : 'safe'
          }`}
        >
          {isExcursion ? '⚠️ Temp Excursion' : '✓ Safe Cold-Chain'}
        </span>
      </div>
      <div className="telemetry-bars">
        {readings.map((r, i) => (
          <div key={i} className="bar-col">
            <span className="bar-val">{r.temp}°C</span>
            <div className="bar-bg">
              <div
                className={`bar-fill ${
                  Number(r.temp) > 8 || Number(r.temp) < 2 ? 'fill-danger' : ''
                }`}
                style={{
                  height: `${Math.min(
                    100,
                    Math.max(25, (Number(r.temp) / 10) * 100)
                  )}%`
                }}
              />
            </div>
            <span className="bar-time">{r.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

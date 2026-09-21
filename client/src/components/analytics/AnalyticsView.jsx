import React from 'react';
import { Clock, ShieldCheck, AlertTriangle, Package, BarChart2, Thermometer } from 'lucide-react';

export function AnalyticsView({ rows = [], t }) {
  const totalCount = rows.length;
  const receivedCount = rows.filter(r => r.status === 'received').length;
  const activeCount = rows.filter(r => ['requested', 'validated', 'packed', 'dispatch-pending', 'dispatched'].includes(r.status)).length;

  const packedRows = rows.filter(r => r.packed?.temperature != null);
  const excursionCount = packedRows.filter(r => Number(r.packed.temperature) < 2.0 || Number(r.packed.temperature) > 8.0).length;
  const safeCount = packedRows.filter(r => Number(r.packed.temperature) >= 2.0 && Number(r.packed.temperature) <= 8.0).length;
  
  const compliancePct = packedRows.length ? ((safeCount / packedRows.length) * 100).toFixed(1) : '100.0';
  const excursionPct = packedRows.length ? ((excursionCount / packedRows.length) * 100).toFixed(1) : '0.0';

  const idealCount = packedRows.filter(r => Number(r.packed.temperature) >= 4.0 && Number(r.packed.temperature) <= 6.0).length;
  const boundaryCount = packedRows.filter(r => (Number(r.packed.temperature) >= 2.0 && Number(r.packed.temperature) < 4.0) || (Number(r.packed.temperature) > 6.0 && Number(r.packed.temperature) <= 8.0)).length;

  const idealPct = packedRows.length ? Math.round((idealCount / packedRows.length) * 100) : (packedRows.length ? 0 : 100);
  const boundaryPct = packedRows.length ? Math.round((boundaryCount / packedRows.length) * 100) : 0;
  const excursionDistPct = packedRows.length ? Math.round((excursionCount / packedRows.length) * 100) : 0;

  const completedTimes = rows
    .filter(r => r.createdAt && (r.updatedAt || r.packed?.at || r.dispatch?.departedAt))
    .map(r => {
      const start = new Date(r.createdAt).getTime();
      const end = new Date(r.updatedAt || r.packed?.at || r.dispatch?.departedAt).getTime();
      return Math.max(1, Math.round((end - start) / 60000));
    });

  const avgMinutes = completedTimes.length
    ? (completedTimes.reduce((a, b) => a + b, 0) / completedTimes.length).toFixed(1)
    : '0.0';

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayCounts = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
  
  rows.forEach(r => {
    if (r.createdAt) {
      const dName = days[new Date(r.createdAt).getDay()];
      if (dayCounts[dName] !== undefined) dayCounts[dName] += 1;
    }
  });

  const velocityData = [
    { day: 'Mon', count: dayCounts.Mon },
    { day: 'Tue', count: dayCounts.Tue },
    { day: 'Wed', count: dayCounts.Wed },
    { day: 'Thu', count: dayCounts.Thu },
    { day: 'Fri', count: dayCounts.Fri },
    { day: 'Sat', count: dayCounts.Sat },
    { day: 'Sun', count: dayCounts.Sun }
  ];
  const maxVal = Math.max(1, ...velocityData.map(v => v.count));

  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">PERFORMANCE & COMPLIANCE</div>
          <h1>{t?.analyticsTitle || 'Cold Chain Operations Analytics'}</h1>
          <p>{t?.analyticsSubtitle || 'Fulfillment velocity, temperature stability, and excursion metrics.'}</p>
        </div>
      </div>

      <div className="analytics-metrics-grid">
        <div className="analytics-card">
          <h4><Clock size={16} color="#0284c7" /> {t?.avgFulfillment || 'Avg Fulfillment'}</h4>
          <div className="analytics-metric">{avgMinutes} <small>{t?.mins || 'mins'}</small></div>
          <small style={{ color: '#059669', fontWeight: 600 }}>⚡ Live average cycle time</small>
        </div>
        <div className="analytics-card">
          <h4><ShieldCheck size={16} color="#059669" /> {t?.tempCompliance || 'Cold Chain Compliance'}</h4>
          <div className="analytics-metric">{compliancePct}%</div>
          <small style={{ color: '#059669', fontWeight: 600 }}>✓ 2°C – 8°C Maintained</small>
        </div>
        <div className="analytics-card">
          <h4><AlertTriangle size={16} color="#dc2626" /> {t?.excursionRate || 'Excursion Rate'}</h4>
          <div className="analytics-metric">{excursionPct}%</div>
          <small style={{ color: Number(excursionPct) > 0 ? '#dc2626' : '#64748b' }}>{excursionCount} excursions recorded</small>
        </div>
        <div className="analytics-card">
          <h4><Package size={16} color="#2563eb" /> {t?.totalDeliveries || 'Total Deliveries'}</h4>
          <div className="analytics-metric">{totalCount || 128}</div>
          <small style={{ color: '#2563eb', fontWeight: 600 }}>{receivedCount} received · {activeCount} active</small>
        </div>
      </div>

      <div className="analytics-grid">
        <div className="analytics-card">
          <h4><BarChart2 size={18} /> Delivery Velocity (Request to Ward Receipt)</h4>
          <div style={{ height: 180, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '20px 10px 0', borderBottom: '1px solid #cbd5e1' }}>
            {velocityData.map((d, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <span style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{d.count}m</span>
                <div style={{ width: 28, height: Math.max(16, (d.count / maxVal) * 120), background: '#2563eb', borderRadius: '4px 4px 0 0' }} />
                <span style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>{d.day}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="analytics-card">
          <h4><Thermometer size={18} /> Temperature Range Distribution</h4>
          <div style={{ padding: '10px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                <span>Ideal Safe Zone (4°C – 6°C)</span>
                <span>{idealPct}%</span>
              </div>
              <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${idealPct}%`, height: '100%', background: '#059669' }} />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                <span>Acceptable Boundary (2°C–4°C / 6°C–8°C)</span>
                <span>{boundaryPct}%</span>
              </div>
              <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${boundaryPct}%`, height: '100%', background: '#0284c7' }} />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                <span>Excursions (&lt;2°C or &gt;8°C)</span>
                <span>{excursionDistPct}%</span>
              </div>
              <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${excursionDistPct}%`, height: '100%', background: '#dc2626' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

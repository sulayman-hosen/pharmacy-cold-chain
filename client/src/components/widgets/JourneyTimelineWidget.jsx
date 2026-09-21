import React from 'react';
import { Activity, FileCheck2, ShieldCheck, Package, Truck } from 'lucide-react';

export function JourneyTimelineWidget({ t }) {
  const steps = [
    [FileCheck2, t.prescriptionCheck, t.readActiveFhir],
    [ShieldCheck, t.formulationMatch, t.verifyDrugDose],
    [Package, t.protectedPacking, t.recordTempLot],
    [Truck, t.courierDeparture, t.updateChartNotify]
  ];

  return (
    <section className="panel flow-panel">
      <div className="panel-top">
        <div>
          <h3>{t.deliveryJourney}</h3>
          <p>{t.connectedPath}</p>
        </div>
        <Activity size={18} />
      </div>
      <div className="journey">
        {steps.map(([Icon, title, description]) => (
          <div key={title} className="journey-step">
            <span>
              <Icon size={17} />
            </span>
            <div>
              <strong>{title}</strong>
              <p>{description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

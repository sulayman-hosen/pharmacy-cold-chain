import React from 'react';
import { Bell, Truck, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { api, enablePush } from '../../api';
import { dateTime } from '../../utils/formatters';

export function NurseInboxView({
  notifications,
  config,
  lang,
  refresh,
  setTab,
  setError,
  t
}) {
  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">
            {t.deliveryUpdatesEyebrow || 'YOUR DELIVERY UPDATES'}
          </div>
          <h1>{t.notificationsTitle || 'My notifications'}</h1>
          <p>
            {t.notificationsSub ||
              'Safe to show on a lock screen. Open requests for patient details.'}
          </p>
        </div>
        {config?.pushEnabled && (
          <Button
            kind="secondary"
            onClick={() =>
              enablePush(config.vapidPublicKey).catch((e) => setError(e.message))
            }
          >
            <Bell size={16} />
            {t.enablePhoneAlerts || 'Enable phone alerts'}
          </Button>
        )}
      </div>

      <section className="panel inbox-list">
        {notifications.length ? (
          notifications.map((n) => {
            const isBn = lang === 'bn';
            const displayTitle =
              isBn && n.payload?.title === 'Delivery update'
                ? 'ডেলিভারি আপডেট'
                : n.payload?.title || 'Delivery update';
            let displayBody = n.payload?.body || '';
            if (
              isBn &&
              (displayBody.includes('is on the way.') ||
                displayBody.includes('refrigerator'))
            ) {
              displayBody = displayBody
                .replace('is on the way.', 'রওনা দিয়েছেন।')
                .replace('ETA', 'পৌঁছানোর সময় (ETA):')
                .replace(
                  'Please place in refrigerator upon receipt.',
                  'ওষুধ আসামাত্র ফ্রিজে রাখুন।'
                )
                .replace(
                  'Open Coldline for details.',
                  'ওষুধ আসামাত্র ফ্রিজে রাখুন।'
                );
            }
            return (
              <article key={n._id} className={n.readAt ? 'read' : ''}>
                <span className="inbox-icon">
                  <Truck size={22} />
                </span>
                <div>
                  <h3>
                    {displayTitle}
                    {!n.readAt && <span className="unread-dot" />}
                  </h3>
                  <p>{displayBody}</p>
                  <small>{dateTime(n.createdAt)}</small>
                </div>
                <Button
                  kind="ghost"
                  onClick={async () => {
                    await api('/notifications/' + n._id + '/read', {
                      method: 'POST'
                    });
                    await refresh();
                    setTab('requests');
                  }}
                >
                  {t.openWorkspace || 'Open workspace'}{' '}
                  <ArrowRight size={15} />
                </Button>
              </article>
            );
          })
        ) : (
          <EmptyState
            icon={Bell}
            title={t.caughtUpTitle || 'You’re all caught up'}
          >
            <p>
              {t.caughtUpBody ||
                'Delivery updates arrive here after the chart is updated.'}
            </p>
          </EmptyState>
        )}
      </section>

      {!config?.pushEnabled && (
        <p className="footnote">
          {t.inappFootnote ||
            'In-app alerts are active. Add VAPID credentials in the server configuration to enable real Web Push.'}
        </p>
      )}
    </>
  );
}

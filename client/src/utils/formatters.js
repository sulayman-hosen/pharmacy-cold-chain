export const statusLabels = {
  requested: 'Awaiting review',
  validated: 'Approved',
  packed: 'Packed',
  'dispatch-pending': 'Chart sync pending',
  dispatched: 'In transit',
  received: 'Received',
  cancelled: 'Cancelled'
};

export const dateTime = (v) =>
  v
    ? new Date(v).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '—';

export const time = (v) =>
  v
    ? new Date(v).toLocaleTimeString(undefined, {
        month: 'short',
        day: 'numeric',
        minute: '2-digit'
      })
    : '—';

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
  } catch (e) {
    // Ignore audio context errors in un-interacted browsers
  }
}

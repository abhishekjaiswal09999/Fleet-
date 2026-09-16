// check-and-notify.js
// Runs once a day via GitHub Actions (see .github/workflows/daily-check.yml).
// No Google billing plan needed — this uses a Firebase service account key
// (stored as a GitHub secret) to read Firestore and send push notifications,
// completely separately from Cloud Functions / Cloud Scheduler.

const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const COMPLIANCE_TYPES = [
  { key: 'tax', label: 'RTO Tax' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'fitness', label: 'Fitness Certificate' },
  { key: 'puc', label: 'PUC Certificate' },
];

// How many days ahead of a due date to start alerting. Overdue items always
// alert regardless of this number.
const ALERT_WINDOW_DAYS = 7;

function daysFromToday(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dateStr.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  return Math.round((due - today) / 86400000);
}

function getAlert(vehicle, key) {
  if (key === 'tax' && vehicle.tax && vehicle.tax.isLifetime) return null;
  const data = vehicle[key] || {};
  if (!data.dueDate) return null;
  const diff = daysFromToday(data.dueDate);
  if (diff < 0) return { level: 'overdue', days: diff };
  if (diff <= ALERT_WINDOW_DAYS) return { level: 'soon', days: diff };
  return null;
}

async function main() {
  const snap = await db.collection('vehicles').get();
  const lines = [];

  for (const doc of snap.docs) {
    const v = doc.data();
    if (!v.active || v.deletedAt) continue;
    for (const { key, label } of COMPLIANCE_TYPES) {
      const alert = getAlert(v, key);
      if (!alert) continue;
      const desc = alert.level === 'overdue'
        ? `${label} overdue by ${Math.abs(alert.days)}d`
        : `${label} due in ${alert.days}d`;
      lines.push(`${v.vehicleNo} — ${desc}`);
    }
  }

  if (lines.length === 0) {
    console.log('Nothing due or overdue today — no notification sent.');
    return;
  }

  const tokensSnap = await db.collection('deviceTokens').get();
  const tokens = tokensSnap.docs.map((d) => d.id);
  if (tokens.length === 0) {
    console.log('No registered devices yet — nothing to send to.');
    return;
  }

  const title = lines.length === 1 ? '1 vehicle needs attention' : `${lines.length} items need attention`;
  const body = lines.slice(0, 4).join(' · ') + (lines.length > 4 ? ` +${lines.length - 4} more` : '');

  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
  });

  const invalidTokens = [];
  response.responses.forEach((r, i) => {
    const code = r.error && r.error.code;
    if (!r.success && (code === 'messaging/invalid-registration-token' || code === 'messaging/registration-token-not-registered')) {
      invalidTokens.push(tokens[i]);
    }
  });
  await Promise.all(invalidTokens.map((t) => db.collection('deviceTokens').doc(t).delete()));

  console.log(`Sent to ${response.successCount}/${tokens.length} devices. Removed ${invalidTokens.length} stale tokens.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

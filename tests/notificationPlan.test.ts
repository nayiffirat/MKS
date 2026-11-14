import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNotificationPlan, PlanInput } from '../utils/notificationPlan';

const base: PlanInput = { myPayments: [], prescriptions: [], payments: [], reminders: [] };
const mp = (id: string, dueDate: string, amount = 5000, status = 'PENDING') => ({ id, amount, issueDate: '2026-11-01', dueDate, type: 'CHECK', status, supplierName: 'Tedarikçi A' } as any);
const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const dueTimes = (plan: ReturnType<typeof buildNotificationPlan>) => plan.filter(n => n.key.startsWith('due:')).map(n => fmt(n.at));

test('Vade: 3 gün kala her akşam 20:00, vade günü 10:00, sonra biter', () => {
  const plan = buildNotificationPlan({ ...base, myPayments: [mp('1', '2026-11-20')] }, new Date(2026, 10, 15, 12, 0));
  assert.deepEqual(dueTimes(plan), ['2026-11-17 20:00', '2026-11-18 20:00', '2026-11-19 20:00', '2026-11-20 10:00']);
});

test('Vade: geçmiş saatler kurulmaz; vade günü 10:00 geçtiyse hiç kalmaz', () => {
  const items = { ...base, myPayments: [mp('1', '2026-11-20')] };
  assert.deepEqual(dueTimes(buildNotificationPlan(items, new Date(2026, 10, 18, 20, 30))), ['2026-11-19 20:00', '2026-11-20 10:00']);
  assert.deepEqual(dueTimes(buildNotificationPlan(items, new Date(2026, 10, 20, 10, 1))), []);
});

test('Vade: ödenmiş / iptal / silinmiş kayıt hatırlatılmaz; aynı güne düşenler tek bildirimde', () => {
  const plan = buildNotificationPlan({ ...base, myPayments: [mp('1', '2026-11-20', 1000), mp('2', '2026-11-20', 2500), mp('3', '2026-11-20', 9, 'PAID'), { ...mp('4', '2026-11-20'), deletedAt: 'x' }] }, new Date(2026, 10, 15, 12, 0));
  const due = plan.filter(n => n.key.startsWith('due:'));
  assert.equal(due.length, 4);
  assert.match(due[0].body, /2 kayıt, toplam 3\.500 ₺/);
});

test('Her gün 09:00 plan ve 21:00 rapor; bugünün raporu gerçek rakamlarla', () => {
  const now = new Date(2026, 10, 13, 8, 0);
  const plan = buildNotificationPlan({
    ...base,
    prescriptions: [{ id: 'a', date: new Date(2026, 10, 13, 7, 0).toISOString(), totalAmount: 1200, type: 'SALE', items: [] } as any],
    payments: [{ id: 'p', date: new Date(2026, 10, 13, 7, 30).toISOString(), amount: 400 } as any],
    reminders: [{ id: 'r', title: 'Ahmet Bey aranacak', description: '', date: new Date(2026, 10, 13, 15, 0).toISOString(), isCompleted: false, priority: 'HIGH', recurrence: 'NONE' }]
  }, now);
  const plans = plan.filter(n => n.key.startsWith('plan:')), reports = plan.filter(n => n.key.startsWith('report:'));
  assert.equal(plans.length, 7);
  assert.equal(reports.length, 7);
  assert.equal(fmt(plans[0].at), '2026-11-13 09:00');
  assert.equal(fmt(reports[0].at), '2026-11-13 21:00');
  assert.match(plans[0].body, /1 hatırlatıcı \(Ahmet Bey aranacak\)/);
  assert.match(reports[0].body, /1 satış · net 1\.200 ₺ · tahsilat 400 ₺/);
  // 09:00 geçtiyse bugünün planı kurulmaz, ertesi günden başlar
  assert.equal(fmt(buildNotificationPlan(base, new Date(2026, 10, 13, 9, 30)).filter(n => n.key.startsWith('plan:'))[0].at), '2026-11-14 09:00');
});

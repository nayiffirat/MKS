/**
 * Zamanlı bildirim planı — saf hesap (platformdan bağımsız, tests/notificationPlan.test.ts ile sınanır).
 *
 * Kurallar:
 *  - Vade hatırlatması: vadeden 3, 2 ve 1 gün önce akşam 20:00'de; vade günü sabah 10:00'da son kez. Sonrası yok.
 *  - Günün raporu: her akşam 21:00.
 *  - Günün planı: her sabah 09:00.
 * Saatler cihazın yerel saatidir. Aynı ana düşen vadeler tek bildirimde toplanır.
 */
import { MyPayment, Prescription, Payment, Reminder } from '../types';

export interface PlannedNotification { key: string; at: Date; title: string; body: string; targetView: 'PAYMENTS' | 'NOTIFICATIONS' }
export interface PlanInput { myPayments: MyPayment[]; prescriptions: Prescription[]; payments: Payment[]; reminders: Reminder[] }

export const PLAN_DAYS = 7;
const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const atLocal = (dateYmd: string, h: number, addDays = 0) => { const [y, m, d] = dateYmd.split('-').map(Number); return new Date(y, m - 1, d + addDays, h, 0, 0, 0); };
/** 'YYYY-MM-DD' ile başlayan değerler yerel gün sayılır; tam ISO zaman damgaları cihaz saatine çevrilir. */
const localDay = (v?: string): string | null => {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}($|T00:00:00)/.test(v) && !/Z$|[+-]\d{2}:\d{2}$/.test(v.slice(10))) return v.slice(0, 10);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? (/^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null) : ymd(d);
};
const tl = (n: number) => `${Math.round(Math.abs(n)).toLocaleString('tr-TR')} ₺`;
const kindOf = (mp: MyPayment) => (mp.type === 'CHECK' ? 'çek' : mp.type === 'PROMISSORY_NOTE' ? 'senet' : mp.type === 'CARD_INSTALLMENT' || mp.type === 'DEFERRED_CARD' ? 'kart' : 'ödeme');

const pendingDues = (myPayments: MyPayment[]) => {
  const byDay = new Map<string, MyPayment[]>();
  for (const mp of myPayments || []) {
    if (mp.deletedAt || mp.status !== 'PENDING') continue;
    const day = localDay(mp.dueDate);
    if (!day) continue;
    byDay.set(day, [...(byDay.get(day) || []), mp]);
  }
  return byDay;
};
const dueList = (items: MyPayment[]) => {
  const total = items.reduce((a, m) => a + (Number(m.amount) || 0), 0);
  const first = items.slice(0, 2).map(m => `${m.farmerName || m.supplierName || 'Cari'} ${tl(m.amount)} (${kindOf(m)})`).join(', ');
  return items.length === 1 ? first : `${items.length} kayıt, toplam ${tl(total)}: ${first}${items.length > 2 ? '…' : ''}`;
};

/** Bir günün özeti (21:00 raporu). */
export function dailyReportText(input: PlanInput, day: string): string {
  const sales = (input.prescriptions || []).filter(p => !p.deletedAt && p.isProcessed !== false && localDay(p.date) === day);
  const net = sales.reduce((a, p) => a + (p.type === 'RETURN' ? -Math.abs(Number(p.totalAmount) || 0) : Math.abs(Number(p.totalAmount) || 0)), 0);
  const collected = (input.payments || []).filter(p => !(p as any).deletedAt && localDay((p as any).date) === day).reduce((a, p) => a + (Number(p.amount) || 0), 0);
  const returns = sales.filter(p => p.type === 'RETURN').length;
  if (!sales.length && !collected) return 'Bugün satış veya tahsilat kaydı yok.';
  return `${sales.length - returns} satış${returns ? `, ${returns} iade` : ''} · net ${tl(net)} · tahsilat ${tl(collected)}.`;
}

/** Bir günün yapılacakları (09:00 planı). */
export function dailyPlanText(input: PlanInput, day: string): string {
  const rem = (input.reminders || []).filter(r => !r.isCompleted && !(r as any).deletedAt && localDay(r.date) === day);
  const dues = pendingDues(input.myPayments).get(day) || [];
  const parts: string[] = [];
  if (rem.length) parts.push(`${rem.length} hatırlatıcı (${rem[0].title}${rem.length > 1 ? '…' : ''})`);
  if (dues.length) parts.push(`vadesi gelen ${dueList(dues)}`);
  return parts.length ? `Bugün: ${parts.join(' · ')}.` : 'Bugün için planlanmış iş veya vade yok. Bereketli mesailer.';
}

/** `from` anından sonraki tüm planlı bildirimler (en yakından uzağa). */
export function buildNotificationPlan(input: PlanInput, from: Date = new Date()): PlannedNotification[] {
  const out: PlannedNotification[] = [];
  const today = ymd(from);

  // 1) Vade hatırlatmaları
  for (const [day, items] of pendingDues(input.myPayments)) {
    for (const before of [3, 2, 1]) {
      out.push({ key: `due:${day}:-${before}`, at: atLocal(day, 20, -before), targetView: 'PAYMENTS', title: `Vadeye ${before} gün kaldı`, body: dueList(items) });
    }
    out.push({ key: `due:${day}:0`, at: atLocal(day, 10), targetView: 'PAYMENTS', title: 'Vade günü: bugün ödenecek / tahsil edilecek', body: dueList(items) });
  }

  // 2) Günün planı 09:00 ve günün raporu 21:00
  for (let i = 0; i < PLAN_DAYS; i++) {
    const day = ymd(atLocal(today, 0, i));
    out.push({ key: `plan:${day}`, at: atLocal(day, 9), targetView: 'NOTIFICATIONS', title: 'Günün planı', body: dailyPlanText(input, day) });
    out.push({
      key: `report:${day}`, at: atLocal(day, 21), targetView: 'NOTIFICATIONS', title: 'Günün raporu',
      body: i === 0 ? dailyReportText(input, day) : 'Bugünün satış, tahsilat ve kasa özeti hazır. Görmek için dokunun.'
    });
  }

  const horizon = atLocal(today, 23, PLAN_DAYS + 3).getTime();
  return out.filter(n => n.at.getTime() > from.getTime() && n.at.getTime() <= horizon).sort((a, b) => a.at.getTime() - b.at.getTime());
}

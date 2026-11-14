import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Send, Search, Loader2, CheckCircle2, RefreshCw, Eye, Settings as SettingsIcon, FileText, Inbox, ArrowLeft, Warehouse, Undo2, ShoppingBag, AlertTriangle, Check, ChevronRight, UserCheck } from 'lucide-react';
import { auth } from '../services/firebase';
import { API_BASE } from '../utils/api';
import { dbService } from '../services/db';
import { useAppViewModel } from '../context/AppContext';
import { EdmConfig, getEdmConfig, saveEdmConfig } from '../utils/edmWarehouseManager';
import { Prescription } from '../types';

type TabId = 'issue' | 'out' | 'in' | 'settings';
type Kind = 'SATIS' | 'IADE';
interface Line { id: string; name: string; quantity: string; unit: string; price: string; vat: number }
interface RemoteInvoice {
  id: string; uuid: string; supplier: string; customer: string; issueDate: string; payableAmount: number;
  profile: string; status: string; responseCode: string;
}

const VAT_RATES = [0, 1, 10, 20];
const digits = (s: string) => (s || '').replace(/\D/g, '');
const num = (s: string) => {
  const v = String(s || '').trim();
  return Number(v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v) || 0;
};
const tl = (n: number) => `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
const trNum = (n: number) => (n ? String(Math.round(n * 1e6) / 1e6).replace('.', ',') : '');
const newLine = (): Line => ({ id: Math.random().toString(36).slice(2), name: '', quantity: '1', unit: 'Adet', price: '', vat: 20 });
const trDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('tr-TR') : '');

const STATUS_TR: Array<[RegExp, string, string]> = [
  [/CANCEL/i, 'İptal', 'bg-rose-500/15 text-rose-400 border-rose-500/30'],
  [/FAIL|ERROR|REJECT/i, 'Hata / Red', 'bg-rose-500/15 text-rose-400 border-rose-500/30'],
  [/PROCESSING|WAIT|LOAD/i, 'İşleniyor', 'bg-amber-500/15 text-amber-400 border-amber-500/30'],
  [/ACCEPT/i, 'Kabul edildi', 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'],
  [/SUCCEED|RECEIVE|SEND/i, 'Başarılı', 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30']
];
const statusOf = (s: string) => STATUS_TR.find(([re]) => re.test(s)) || [/./, s || '—', 'bg-stone-800 text-stone-300 border-white/10'];
const needsReply = (inv: RemoteInvoice) => inv.profile === 'TICARIFATURA' && !inv.responseCode && !!inv.id && !/CANCEL|REJECT|ACCEPT/i.test(inv.status);

async function edmPost(path: string, cfg: EdmConfig, body: Record<string, unknown> = {}) {
  const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : '';
  const resp = await fetch(`${API_BASE}/api/edm/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
    body: JSON.stringify({ username: cfg.username.trim(), password: cfg.password, environment: cfg.edmEnv === 'LIVE' ? 'LIVE' : 'TEST', ...body })
  });
  return resp.json().catch(() => ({ ok: false, error: 'Sunucudan geçersiz yanıt alındı.' }));
}
const offline = () => ({ ok: false, error: 'Sunucuya ulaşılamadı.' } as any);

const inputCls = 'w-full min-h-[44px] px-3 py-2 bg-stone-950 border border-white/15 rounded-xl text-sm text-stone-100 placeholder-stone-500 outline-none focus:border-emerald-500/60';
const labelCls = 'block text-[11px] font-bold text-stone-400 mb-1';
const cardCls = 'rounded-2xl border border-white/10 bg-stone-950/40 p-3 space-y-2.5';

const Step: React.FC<{ n: number; title: string; right?: React.ReactNode; children: React.ReactNode }> = ({ n, title, right, children }) => (
  <section className={cardCls}>
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-extrabold text-stone-100 flex items-center gap-2">
        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-black flex items-center justify-center">{n}</span>
        {title}
      </h3>
      {right}
    </div>
    {children}
  </section>
);

export interface EFaturaPrefill {
  kind?: Kind;
  saleId?: string; // bu satış kaydına bağlı: stok ve cari zaten işlendi
  farmerId?: string;
  name: string;
  taxNo?: string;
  district?: string;
  lines: Array<{ name: string; quantity: number; unit?: string; price: number }>;
  note?: string;
}

export const EFaturaPanel: React.FC<{ isOpen: boolean; initialTab?: TabId; prefill?: EFaturaPrefill | null; onClose: () => void }> = ({ isOpen, initialTab = 'issue', prefill, onClose }) => {
  const { farmers, inventory, prescriptions, addPrescription, refreshPrescriptions, userProfile, showToast } = useAppViewModel();
  const [tab, setTab] = useState<TabId>(initialTab);
  const [cfg, setCfg] = useState<EdmConfig>(getEdmConfig);
  const isLive = cfg.edmEnv === 'LIVE';
  const hasCreds = Boolean(cfg.username.trim() && (cfg.password || '').trim());
  const hasCompany = Boolean((digits(cfg.companyVknOrTc).length === 10 || digits(cfg.companyVknOrTc).length === 11) && cfg.companyTitle.trim());

  useEffect(() => {
    if (isOpen) {
      const fresh = getEdmConfig();
      setCfg(fresh);
      const ready = fresh.username.trim() && (fresh.password || '').trim() && fresh.companyTitle.trim();
      setTab(ready ? initialTab : 'settings');
    }
  }, [isOpen, initialTab]);

  const updateCfg = (patch: Partial<EdmConfig>) => {
    setCfg(prev => {
      const next = { ...prev, ...patch, enabled: true };
      saveEdmConfig(next);
      return next;
    });
  };

  // ------------------------------------------------------------ Fatura kes
  const [kind, setKind] = useState<Kind>('SATIS');
  const [saleId, setSaleId] = useState('');
  const [farmerId, setFarmerId] = useState('');
  const [custName, setCustName] = useState('');
  const [custTax, setCustTax] = useState('');
  const [custDistrict, setCustDistrict] = useState('');
  const [custCity, setCustCity] = useState('');
  const [custQuery, setCustQuery] = useState('');
  const [refNo, setRefNo] = useState('');
  const [refDate, setRefDate] = useState('');
  const [payer, setPayer] = useState<{ state: 'idle' | 'busy' | 'done' | 'fail'; isEInvoice?: boolean; alias?: string; message?: string }>({ state: 'idle' });
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [vatIncluded, setVatIncluded] = useState(true);
  const [note, setNote] = useState('');
  const [ledger, setLedger] = useState(true);
  const [payType, setPayType] = useState<'TERM' | 'CASH'>('TERM');
  const [showAllSales, setShowAllSales] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sent, setSent] = useState<{ invoiceNo: string; uuid: string; payable: number; docType: string; ledger: 'linked' | 'created' | 'failed' | 'none' } | null>(null);

  const clearForm = (nextKind: Kind = 'SATIS') => {
    setSent(null); setKind(nextKind); setSaleId(''); setFarmerId(''); setCustName(''); setCustTax(''); setCustDistrict(''); setCustCity(''); setCustQuery('');
    setRefNo(''); setRefDate(''); setLines([newLine()]); setNote(''); setSendError(''); setConfirming(false); setVatIncluded(true); setLedger(true); setPayType('TERM');
  };

  const unitOf = (name: string) => inventory.find(i => i.pesticideName === name)?.unit;
  const applyPrefill = (p: EFaturaPrefill) => {
    clearForm(p.kind || 'SATIS');
    setSaleId(p.saleId || ''); setFarmerId(p.farmerId || '');
    setCustName(p.name || ''); setCustTax(digits(p.taxNo || '')); setCustDistrict(p.district || ''); setNote(p.note || '');
    setLines(p.lines.length ? p.lines.map(l => ({ ...newLine(), name: l.name, quantity: trNum(l.quantity || 1), unit: l.unit || unitOf(l.name) || 'Adet', price: trNum(l.price) })) : [newLine()]);
  };

  // Satış ekranından gelen hazır fatura bilgisi
  useEffect(() => {
    if (isOpen && prefill) applyPrefill(prefill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, prefill]);

  const saleToPrefill = (p: Prescription): EFaturaPrefill => {
    const farmer = farmers.find(f => f.id === p.farmerId);
    return {
      kind: p.type === 'RETURN' ? 'IADE' : 'SATIS', saleId: p.id, farmerId: p.farmerId,
      name: farmer?.fullName || '', taxNo: p.farmerTcNo || farmer?.tcNo || '', district: farmer?.village || '', note: p.prescriptionNo,
      lines: p.items.map(it => {
        const qty = Math.abs(num(String(it.quantity || '1'))) || 1;
        return { name: it.pesticideName, quantity: qty, unit: inventory.find(i => i.pesticideId === it.pesticideId)?.unit, price: it.unitPrice || (it.totalPrice ? Math.abs(it.totalPrice) / qty : 0) };
      })
    };
  };

  // Faturası kesilmemiş satışlar (iade modunda: iade kayıtları)
  const pendingSales = useMemo(
    () => prescriptions
      .filter(p => !p.deletedAt && !p.eInvoiceNo && (p.items || []).length > 0 && (kind === 'IADE' ? p.type === 'RETURN' : p.type !== 'RETURN'))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 30),
    [prescriptions, kind]
  );

  const farmerMatches = useMemo(() => {
    const q = custQuery.trim().toLocaleLowerCase('tr-TR');
    if (q.length < 2) return [];
    return farmers.filter(f => f.fullName.toLocaleLowerCase('tr-TR').includes(q) || (f.tcNo || '').includes(q)).slice(0, 6);
  }, [custQuery, farmers]);

  const calc = useMemo(() => {
    const rows = lines.map(l => {
      const qty = num(l.quantity);
      const entered = num(l.price);
      const net = vatIncluded ? entered / (1 + l.vat / 100) : entered;
      const lineNet = Math.round(qty * net * 100) / 100;
      const lineTax = Math.round(lineNet * l.vat) / 100;
      return { ...l, qty, netUnit: net, lineNet, lineTax };
    });
    const net = rows.reduce((s, r) => s + r.lineNet, 0);
    const tax = rows.reduce((s, r) => s + r.lineTax, 0);
    return { rows, net, tax, total: Math.round((net + tax) * 100) / 100 };
  }, [lines, vatIncluded]);

  const linkedSale = saleId ? prescriptions.find(p => p.id === saleId) : undefined;
  const linkedFarmer = farmerId ? farmers.find(f => f.id === farmerId) : undefined;
  const willRecord = !saleId && ledger && !!linkedFarmer;
  const unmatched = willRecord ? calc.rows.filter(r => r.name.trim() && !inventory.some(i => i.pesticideName === r.name.trim())).map(r => r.name.trim()) : [];

  const taxLen = digits(custTax).length;
  const formError = !custName.trim()
    ? 'Alıcı adını yazın.'
    : taxLen !== 10 && taxLen !== 11
      ? 'Alıcının TC kimlik no (11 hane) veya vergi no (10 hane) gerekli.'
      : calc.rows.some(r => !r.name.trim() || r.qty <= 0 || num(r.price) <= 0)
        ? 'Her satırda ürün adı, miktar ve fiyat olmalı.'
        : kind === 'IADE' && (!refNo.trim() || !refDate)
          ? 'İade edilen faturanın numarasını ve tarihini girin.'
          : '';

  const checkPayer = async (): Promise<{ isEInvoice: boolean; alias: string } | null> => {
    setPayer({ state: 'busy' });
    const data = await edmPost('check-user', cfg, { identifier: digits(custTax) }).catch(offline);
    if (!data?.ok) {
      setPayer({ state: 'fail', message: data?.error || 'Sorgu yapılamadı.' });
      return null;
    }
    const alias = (data.aliases || [])[0] || '';
    setPayer({ state: 'done', isEInvoice: !!data.isEInvoiceUser, alias });
    if (data.isEInvoiceUser && data.title && !custName.trim()) setCustName(data.title);
    return { isEInvoice: !!data.isEInvoiceUser, alias };
  };

  useEffect(() => {
    setPayer({ state: 'idle' });
    setConfirming(false);
  }, [custTax]);

  const startSend = async () => {
    setSendError('');
    if (formError) return setSendError(formError);
    if (!hasCreds || !hasCompany) {
      setTab('settings');
      showToast?.('Önce Ayarlar sekmesindeki bilgileri tamamlayın.', 'info');
      return;
    }
    if (payer.state !== 'done') {
      const r = await checkPayer();
      if (!r) return;
    }
    setConfirming(true);
  };

  /** Fatura kesildikten sonra: bağlı satışı işaretle ya da yeni satış/iade kaydı açıp stok ve cariye işle. */
  const recordLedger = async (invoiceNo: string, uuid: string): Promise<'linked' | 'created' | 'failed' | 'none'> => {
    try {
      if (linkedSale) {
        await dbService.updatePrescription({ ...linkedSale, eInvoiceNo: invoiceNo, eInvoiceUuid: uuid });
        await refreshPrescriptions();
        return 'linked';
      }
      if (!willRecord || !linkedFarmer) return 'none';
      const isReturn = kind === 'IADE';
      const items = calc.rows.map(r => {
        const inv = inventory.find(i => i.pesticideName === r.name.trim());
        const gross = Math.round((r.lineNet + r.lineTax) * 100) / 100;
        return {
          pesticideId: inv?.pesticideId || `efatura-${r.id}`, pesticideName: r.name.trim(), dosage: '', quantity: String(r.qty),
          unitPrice: Math.round((gross / r.qty) * 100) / 100, totalPrice: gross, buyingPrice: inv?.buyingPrice, gtin: inv?.gtin
        };
      });
      await addPrescription({
        farmerId: linkedFarmer.id, farmerTcNo: digits(custTax), date: new Date().toISOString(), type: isReturn ? 'RETURN' : 'SALE',
        engineerName: userProfile?.fullName || '', items, isOfficial: true, isProcessed: true, saleRegistryMode: 'FREE',
        totalAmount: isReturn ? -calc.total : calc.total, priceType: payType, eInvoiceNo: invoiceNo, eInvoiceUuid: uuid
      });
      return 'created';
    } catch (e) {
      console.error('e-Fatura stok/cari kaydı', e);
      return 'failed';
    }
  };

  const doSend = async () => {
    if (sending) return;
    setSending(true);
    setSendError('');
    const isEInvoice = !!payer.isEInvoice;
    const data = await edmPost('send-invoice', cfg, {
      invoice: {
        docType: isEInvoice ? 'EFATURA' : 'EARSIV',
        invoiceType: kind,
        ...(kind === 'IADE' ? { refInvoiceNo: refNo.trim(), refInvoiceDate: refDate } : {}),
        sender: {
          taxNo: digits(cfg.companyVknOrTc), name: cfg.companyTitle.trim(), address: cfg.companyAddress || '',
          district: cfg.companyDistrict || '', city: cfg.companyCity || '', taxOffice: cfg.companyTaxOffice || ''
        },
        receiver: { taxNo: digits(custTax), name: custName.trim(), district: custDistrict.trim(), city: custCity.trim() },
        receiverAlias: payer.alias || '',
        lines: calc.rows.map(r => ({ name: r.name.trim(), quantity: r.qty, unit: r.unit, unitPrice: Math.round(r.netUnit * 1e6) / 1e6, vatRate: r.vat })),
        note: note.trim()
      }
    }).catch(() => ({ ok: false, error: 'Sunucuya ulaşılamadı. Fatura gönderilmedi.' } as any));
    if (!data?.ok) {
      setSending(false);
      setConfirming(false);
      return setSendError(data?.error || 'Fatura gönderilemedi.');
    }
    const ledgerResult = await recordLedger(data.invoiceNo, data.uuid);
    setSending(false);
    setConfirming(false);
    setSent({ invoiceNo: data.invoiceNo, uuid: data.uuid, payable: data.payableAmount, docType: `${isEInvoice ? 'e-Fatura' : 'e-Arşiv'}${kind === 'IADE' ? ' iade faturası' : ''}`, ledger: ledgerResult });
  };

  // ------------------------------------------------------------ Listeler
  const [list, setList] = useState<{ state: 'idle' | 'busy' | 'done' | 'fail'; items: RemoteInvoice[]; message?: string }>({ state: 'idle', items: [] });
  const [days, setDays] = useState(7);
  const [listQuery, setListQuery] = useState('');
  const [viewer, setViewer] = useState<{ state: 'busy' | 'done' | 'fail'; html?: string; title: string; message?: string; inv?: RemoteInvoice; direction?: 'IN' | 'OUT' } | null>(null);
  const [action, setAction] = useState<{ kind: 'cancel' | 'accept' | 'reject' | null; busy?: boolean; message?: string; ok?: boolean }>({ kind: null });
  const [returnBusy, setReturnBusy] = useState(false);

  const loadList = async (direction: 'IN' | 'OUT') => {
    if (!hasCreds) return setList({ state: 'fail', items: [], message: 'Önce Ayarlar sekmesinden EDM kullanıcı bilgilerini girin.' });
    setList({ state: 'busy', items: [] });
    const startDate = new Date(Date.now() - (days - 1) * 86_400_000 + 3 * 3_600_000).toISOString().slice(0, 10);
    const data = await edmPost('invoices', cfg, { direction, startDate }).catch(offline);
    if (!data?.ok) return setList({ state: 'fail', items: [], message: data?.error || 'Liste alınamadı.' });
    const items = (data.invoices as RemoteInvoice[]).slice().sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || '') || (b.id || '').localeCompare(a.id || ''));
    setList({ state: 'done', items });
  };

  useEffect(() => {
    if (isOpen && (tab === 'out' || tab === 'in')) void loadList(tab === 'out' ? 'OUT' : 'IN');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isOpen, days]);

  const shownList = useMemo(() => {
    const q = listQuery.trim().toLocaleLowerCase('tr-TR');
    if (!q) return list.items;
    return list.items.filter(i => `${i.customer} ${i.supplier} ${i.id}`.toLocaleLowerCase('tr-TR').includes(q));
  }, [list.items, listQuery]);
  const waitingCount = tab === 'in' ? list.items.filter(needsReply).length : 0;

  const openInvoice = async (uuid: string, title: string, direction: 'IN' | 'OUT', inv?: RemoteInvoice) => {
    setAction({ kind: null });
    setViewer({ state: 'busy', title, inv, direction });
    const data = await edmPost('invoice-html', cfg, { uuid, direction }).catch(offline);
    setViewer(data?.ok ? { state: 'done', html: data.html, title, inv, direction } : { state: 'fail', title, inv, direction, message: data?.error || 'Fatura açılamadı.' });
  };

  const runAction = async () => {
    if (!viewer?.inv || !action.kind || action.busy) return;
    const k = action.kind;
    setAction({ kind: k, busy: true });
    const data = k === 'cancel'
      ? await edmPost('cancel-invoice', cfg, { uuid: viewer.inv.uuid }).catch(offline)
      : await edmPost('respond-invoice', cfg, { invoiceId: viewer.inv.id, accept: k === 'accept' }).catch(offline);
    setAction({ kind: null, ok: !!data?.ok, message: data?.ok ? (k === 'cancel' ? 'Fatura iptal edildi.' : k === 'accept' ? 'Fatura kabul edildi.' : 'Fatura reddedildi.') : data?.error || 'İşlem yapılamadı.' });
    if (data?.ok) void loadList(viewer.direction === 'OUT' ? 'OUT' : 'IN');
  };

  /** Giden faturadan iade faturası hazırla: alıcı, satırlar ve asıl fatura bilgisi otomatik dolar. */
  const startReturnFrom = async (inv: RemoteInvoice) => {
    if (returnBusy) return;
    setReturnBusy(true);
    const d = await edmPost('invoice-detail', cfg, { uuid: inv.uuid, direction: 'OUT' }).catch(offline);
    setReturnBusy(false);
    if (!d?.ok) return setAction({ kind: null, ok: false, message: d?.error || 'Fatura içeriği alınamadı.' });
    const tax = digits(d.customer?.taxNo || '');
    const farmer = tax ? farmers.find(f => digits(f.tcNo || '') === tax) : undefined;
    clearForm('IADE');
    setFarmerId(farmer?.id || '');
    setCustName(d.customer?.name || inv.customer || ''); setCustTax(tax); setCustDistrict(d.customer?.district || ''); setCustCity(d.customer?.city || '');
    setRefNo(d.invoiceNo || inv.id || ''); setRefDate(d.issueDate || (inv.issueDate || '').slice(0, 10));
    setVatIncluded(false);
    setLines((d.lines || []).length ? d.lines.map((l: any) => ({ ...newLine(), name: l.name, quantity: trNum(l.quantity), unit: l.unit || 'Adet', price: trNum(l.unitPrice), vat: VAT_RATES.includes(l.vatRate) ? l.vatRate : 20 })) : [newLine()]);
    setViewer(null);
    setTab('issue');
  };

  // ------------------------------------------------------------ Ayarlar
  const [conn, setConn] = useState<{ state: 'idle' | 'busy' | 'ok' | 'fail'; message?: string }>({ state: 'idle' });
  const testConnection = async () => {
    if (!hasCreds) return setConn({ state: 'fail', message: 'Kullanıcı adı ve şifreyi girin.' });
    setConn({ state: 'busy' });
    const data = await edmPost('test-connection', cfg).catch(offline);
    setConn(data?.ok ? { state: 'ok', message: data.message } : { state: 'fail', message: data?.error || 'Bağlantı kurulamadı.' });
  };

  if (!isOpen) return null;

  const tabs: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
    { id: 'issue', label: 'Fatura Kes', icon: FileText },
    { id: 'out', label: 'Giden', icon: Send },
    { id: 'in', label: 'Gelen', icon: Inbox },
    { id: 'settings', label: 'Ayarlar', icon: SettingsIcon }
  ];
  const docLabel = `${payer.isEInvoice ? 'e-Fatura' : 'e-Arşiv fatura'}${kind === 'IADE' ? ' (iade)' : ''}`;
  const showIssueForm = tab === 'issue' && !sent && !viewer;
  const setLine = (id: string, patch: Partial<Line>) => setLines(prev => prev.map(x => (x.id === id ? { ...x, ...patch } : x)));

  // Alt menü ve üst çubuğun üstünde kalması için gövdeye (body) çizilir
  return createPortal(
    <div className="fixed inset-0 z-[120] bg-black/75 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div
        className="bg-stone-900 w-full sm:max-w-2xl h-[100dvh] sm:h-[92dvh] sm:rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Başlık */}
        <div className="shrink-0 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2.5 flex items-center justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0"><FileText size={19} /></div>
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-stone-100 leading-tight">e-Fatura</h2>
              <p className={`text-[11px] font-bold ${isLive ? 'text-emerald-400' : 'text-amber-400'}`}>{isLive ? 'Canlı · resmî fatura' : 'Test ortamı · deneme'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat" className="shrink-0 w-10 h-10 rounded-xl bg-stone-800 text-stone-300 flex items-center justify-center">
            <X size={20} />
          </button>
        </div>

        {/* Sekmeler */}
        <div className="shrink-0 px-3 pb-2 border-b border-white/10">
          <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-stone-950/60 border border-white/10">
            {tabs.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => { setTab(t.id); setViewer(null); }}
                aria-pressed={tab === t.id}
                className={`min-h-[40px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${tab === t.id ? 'bg-emerald-600 text-white shadow' : 'text-stone-400 hover:text-stone-200'}`}
              >
                <t.icon size={14} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-3">
          {/* ---------------- FATURA KESİLDİ ---------------- */}
          {tab === 'issue' && sent && !viewer && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center space-y-3">
              <CheckCircle2 size={44} className="mx-auto text-emerald-400" />
              <div>
                <p className="text-base font-extrabold text-stone-100">{sent.docType} kesildi</p>
                <p className="text-sm text-stone-300 mt-1"><b className="font-mono">{sent.invoiceNo || '—'}</b> · {tl(sent.payable)}</p>
                {sent.ledger === 'linked' && <p className="text-xs text-emerald-400 font-bold mt-2">Satış kaydına işlendi (stok ve cari zaten güncel).</p>}
                {sent.ledger === 'created' && <p className="text-xs text-emerald-400 font-bold mt-2">Stok ve cari hesaba işlendi.</p>}
                {sent.ledger === 'none' && <p className="text-xs text-stone-400 mt-2">Stok ve cari hesaba işlenmedi.</p>}
                {sent.ledger === 'failed' && <p className="text-xs text-rose-400 font-bold mt-2">Fatura kesildi ama stok/cari kaydı yapılamadı. Satışı elle kaydedin.</p>}
                {!isLive && <p className="text-[11px] text-amber-400 mt-1">Test ortamı: bu belge resmî değildir.</p>}
              </div>
              <div className="flex gap-2 justify-center">
                <button type="button" onClick={() => void openInvoice(sent.uuid, sent.invoiceNo, 'OUT')} className="min-h-[44px] px-4 rounded-xl bg-stone-800 text-stone-200 text-sm font-bold flex items-center gap-1.5">
                  <Eye size={15} /> Görüntüle
                </button>
                <button type="button" onClick={() => clearForm()} className="min-h-[44px] px-4 rounded-xl bg-emerald-600 text-white text-sm font-bold flex items-center gap-1.5">
                  <Plus size={15} /> Yeni Fatura
                </button>
              </div>
            </div>
          )}

          {/* ---------------- FATURA KES ---------------- */}
          {showIssueForm && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {([['SATIS', 'Satış Faturası', ShoppingBag], ['IADE', 'İade Faturası', Undo2]] as const).map(([k, label, Icon]) => (
                  <button key={k} type="button" onClick={() => { if (kind !== k) clearForm(k); }} aria-pressed={kind === k}
                    className={`min-h-[46px] rounded-xl text-sm font-extrabold border flex items-center justify-center gap-2 ${kind === k ? (k === 'IADE' ? 'bg-rose-600 text-white border-rose-500' : 'bg-emerald-600 text-white border-emerald-500') : 'bg-stone-950/40 text-stone-400 border-white/10'}`}>
                    <Icon size={16} /> {label}
                  </button>
                ))}
              </div>

              {/* Hazır satışlardan seç */}
              {!saleId && !custName.trim() && pendingSales.length > 0 && (
                <section className={cardCls}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold text-stone-200">{kind === 'IADE' ? 'Faturası kesilmemiş iadeler' : 'Faturası kesilmemiş satışlar'}</h3>
                    <span className="text-[11px] text-stone-500">dokun, hazır gelsin</span>
                  </div>
                  <div className="space-y-1.5">
                    {pendingSales.slice(0, showAllSales ? 30 : 3).map(p => (
                      <button key={p.id} type="button" onClick={() => applyPrefill(saleToPrefill(p))}
                        className="w-full text-left rounded-xl bg-stone-900 border border-white/10 px-3 py-2 flex items-center gap-2 active:scale-[0.99] transition-transform">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-stone-100 truncate">{farmers.find(f => f.id === p.farmerId)?.fullName || 'Müşteri'}</p>
                          <p className="text-[11px] text-stone-400 truncate">{trDate(p.date)} · {p.prescriptionNo} · {p.items.length} ürün</p>
                        </div>
                        <span className="shrink-0 text-sm font-extrabold text-stone-100 tabular-nums">{tl(Math.abs(p.totalAmount || 0))}</span>
                        <ChevronRight size={16} className="shrink-0 text-stone-500" />
                      </button>
                    ))}
                  </div>
                  {pendingSales.length > 3 && (
                    <button type="button" onClick={() => setShowAllSales(v => !v)} className="w-full min-h-[36px] text-xs font-bold text-emerald-400">
                      {showAllSales ? 'Daha az göster' : `Tümünü göster (${pendingSales.length})`}
                    </button>
                  )}
                </section>
              )}

              {linkedSale && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 flex items-center gap-2">
                  <Check size={16} className="shrink-0 text-emerald-400" />
                  <p className="flex-1 text-xs text-stone-200"><b>{linkedSale.prescriptionNo}</b> kaydına bağlı. Stok ve cari bu kayıtta işlendi; tekrar işlenmez.</p>
                  <button type="button" onClick={() => clearForm(kind)} className="shrink-0 min-h-[32px] px-2 rounded-lg bg-stone-800 text-stone-300 text-[11px] font-bold">Temizle</button>
                </div>
              )}

              <Step n={1} title="Alıcı">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                  <input value={custQuery} onChange={e => setCustQuery(e.target.value)} placeholder="Kayıtlı müşteri ara (ad veya TC)" className={`${inputCls} pl-9`} />
                  {farmerMatches.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 top-full mt-1 rounded-xl border border-white/15 bg-stone-900 shadow-xl overflow-hidden">
                      {farmerMatches.map(f => (
                        <button key={f.id} type="button"
                          onClick={() => { setFarmerId(f.id); setCustName(f.fullName); setCustTax(digits(f.tcNo || '')); setCustDistrict(f.village || ''); setCustQuery(''); }}
                          className="w-full text-left px-3 py-2.5 text-sm text-stone-200 hover:bg-white/5 flex justify-between gap-2">
                          <span className="truncate font-semibold">{f.fullName}</span>
                          <span className="shrink-0 text-xs text-stone-500">{f.village}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2 sm:col-span-1">
                    <label className={labelCls}>Ad Soyad / Ünvan</label>
                    <input value={custName} onChange={e => setCustName(e.target.value)} className={inputCls} />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className={labelCls}>TC Kimlik No / Vergi No</label>
                    <input value={custTax} onChange={e => setCustTax(digits(e.target.value).slice(0, 11))} onBlur={() => { if ((taxLen === 10 || taxLen === 11) && hasCreds && payer.state === 'idle') void checkPayer(); }} inputMode="numeric" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>İlçe / Köy</label>
                    <input value={custDistrict} onChange={e => setCustDistrict(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>İl</label>
                    <input value={custCity} onChange={e => setCustCity(e.target.value)} className={inputCls} />
                  </div>
                </div>
                {linkedFarmer && !saleId && <p className="text-[11px] text-stone-400 flex items-center gap-1.5"><UserCheck size={13} className="text-emerald-400" /> Kayıtlı müşteri: <b className="text-stone-200">{linkedFarmer.fullName}</b></p>}
                {payer.state === 'busy' && <p className="text-xs text-stone-400 flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Mükellef sorgulanıyor…</p>}
                {payer.state === 'done' && (
                  <p className={`text-xs font-bold ${payer.isEInvoice ? 'text-emerald-400' : 'text-sky-400'}`}>
                    {payer.isEInvoice ? 'e-Fatura mükellefi → e-Fatura kesilecek.' : 'e-Fatura mükellefi değil → e-Arşiv fatura kesilecek.'}
                  </p>
                )}
                {payer.state === 'fail' && <p className="text-xs font-bold text-rose-400">{payer.message}</p>}
              </Step>

              {kind === 'IADE' && (
                <Step n={2} title="İade edilen fatura">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Fatura numarası</label>
                      <input value={refNo} onChange={e => setRefNo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16))} placeholder="EA42026000000001" className={`${inputCls} font-mono`} />
                    </div>
                    <div>
                      <label className={labelCls}>Fatura tarihi</label>
                      <input type="date" value={refDate} onChange={e => setRefDate(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  <p className="text-[11px] text-stone-400">Kolay yol: <b>Giden</b> sekmesinde faturayı açıp “İade Faturası Kes”e basın; her şey otomatik dolar.</p>
                </Step>
              )}

              <Step n={kind === 'IADE' ? 3 : 2} title="Ürünler" right={
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-stone-300 cursor-pointer">
                  <input type="checkbox" checked={vatIncluded} onChange={e => setVatIncluded(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
                  Fiyatlar KDV dahil
                </label>
              }>
                <datalist id="efatura-products">
                  {inventory.slice(0, 400).map(i => <option key={i.id} value={i.pesticideName} />)}
                </datalist>
                {lines.map((l, idx) => {
                  const row = calc.rows[idx];
                  return (
                    <div key={l.id} className="rounded-xl border border-white/10 bg-stone-900 p-2.5 space-y-2">
                      <div className="flex gap-2">
                        <input
                          list="efatura-products"
                          value={l.name}
                          placeholder={`${idx + 1}. ürün adı`}
                          onChange={e => {
                            const name = e.target.value;
                            const item = inventory.find(i => i.pesticideName === name);
                            setLine(l.id, { name, ...(item ? { unit: item.unit || l.unit, price: l.price || trNum(item.sellingPrice || 0) } : {}) });
                          }}
                          className={inputCls}
                        />
                        {lines.length > 1 && (
                          <button type="button" aria-label="Satırı sil" onClick={() => setLines(prev => prev.filter(x => x.id !== l.id))} className="shrink-0 w-[44px] h-[44px] rounded-xl bg-stone-800 text-stone-400 hover:text-rose-400 flex items-center justify-center">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className={labelCls}>Miktar</label>
                          <input value={l.quantity} inputMode="decimal" onChange={e => setLine(l.id, { quantity: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Birim</label>
                          <select value={l.unit} onChange={e => setLine(l.id, { unit: e.target.value })} className={inputCls}>
                            {[...new Set(['Adet', 'Kg', 'Lt', 'Gr', 'Ml', 'Ton', 'Paket', 'Kutu', l.unit])].map(u => <option key={u}>{u}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Birim fiyat</label>
                          <input value={l.price} inputMode="decimal" placeholder="0,00" onChange={e => setLine(l.id, { price: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>KDV %</label>
                          <select value={l.vat} onChange={e => setLine(l.id, { vat: Number(e.target.value) })} className={inputCls}>
                            {VAT_RATES.map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                        </div>
                      </div>
                      {row && row.lineNet > 0 && <p className="text-right text-[11px] text-stone-400">Satır toplamı: <b className="text-stone-200 tabular-nums">{tl(row.lineNet + row.lineTax)}</b></p>}
                    </div>
                  );
                })}
                <button type="button" onClick={() => setLines(prev => [...prev, newLine()])} className="w-full min-h-[42px] rounded-xl border border-dashed border-white/20 text-stone-300 text-xs font-bold flex items-center justify-center gap-1.5">
                  <Plus size={14} /> Ürün ekle
                </button>
                <input value={note} onChange={e => setNote(e.target.value)} placeholder="Fatura notu (isteğe bağlı)" className={inputCls} />
              </Step>

              {/* Stok ve cari */}
              {!saleId && (
                <section className={cardCls}>
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={ledger && !!linkedFarmer} disabled={!linkedFarmer} onChange={e => setLedger(e.target.checked)} className="mt-0.5 w-5 h-5 accent-emerald-600" />
                    <span className="min-w-0">
                      <span className="block text-sm font-extrabold text-stone-100">Stok ve cari hesaba işle</span>
                      <span className="block text-[11px] text-stone-400">
                        {!linkedFarmer
                          ? 'Bunun için yukarıdan kayıtlı bir müşteri seçin.'
                          : kind === 'IADE' ? 'Ürünler stoğa geri eklenir, tutar müşterinin hesabından düşülür.' : 'Ürünler stoktan düşülür, tutar müşterinin hesabına yazılır.'}
                      </span>
                    </span>
                  </label>
                  {willRecord && (
                    <div className="grid grid-cols-2 gap-2">
                      {([['TERM', kind === 'IADE' ? 'Cariden düş' : 'Vadeli (cariye borç)'], ['CASH', kind === 'IADE' ? 'Kasadan öde' : 'Peşin (kasaya)']] as const).map(([k, label]) => (
                        <button key={k} type="button" onClick={() => setPayType(k)} aria-pressed={payType === k}
                          className={`min-h-[42px] rounded-xl text-xs font-bold border ${payType === k ? 'bg-stone-700 text-white border-white/20' : 'bg-stone-950 text-stone-400 border-white/10'}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                  {unmatched.length > 0 && (
                    <p className="text-[11px] text-amber-400 flex items-start gap-1.5"><AlertTriangle size={13} className="shrink-0 mt-0.5" /> Stokta bulunamadı: {unmatched.join(', ')}. {kind === 'IADE' ? 'Yeni stok kalemi olarak eklenir.' : 'Bu ürünler stoktan düşülmez.'} Listeden seçerseniz eşleşir.</p>
                  )}
                </section>
              )}
            </>
          )}

          {/* ---------------- GİDEN / GELEN ---------------- */}
          {(tab === 'out' || tab === 'in') && !viewer && (
            <>
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1 p-1 rounded-xl bg-stone-950/60 border border-white/10">
                  {[[1, 'Bugün'], [7, '7 gün'], [30, '30 gün']].map(([d, label]) => (
                    <button key={d} type="button" onClick={() => setDays(d as number)} aria-pressed={days === d}
                      className={`min-h-[34px] px-2.5 rounded-lg text-xs font-bold ${days === d ? 'bg-stone-700 text-white' : 'text-stone-400'}`}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="relative flex-1 min-w-0">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-500" />
                  <input value={listQuery} onChange={e => setListQuery(e.target.value)} placeholder="Ara" className="w-full min-h-[42px] pl-8 pr-2 bg-stone-950 border border-white/15 rounded-xl text-sm text-stone-100 placeholder-stone-500 outline-none" />
                </div>
                <button type="button" aria-label="Yenile" onClick={() => void loadList(tab === 'out' ? 'OUT' : 'IN')} disabled={list.state === 'busy'} className="shrink-0 w-[42px] h-[42px] rounded-xl bg-stone-800 text-stone-300 flex items-center justify-center">
                  <RefreshCw size={15} className={list.state === 'busy' ? 'animate-spin' : ''} />
                </button>
              </div>
              {waitingCount > 0 && <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-400">{waitingCount} fatura yanıtınızı bekliyor. Açıp Kabul Et veya Reddet'e basın.</p>}
              {list.state === 'busy' && <p className="py-10 text-center text-sm text-stone-400 flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> EDM'den alınıyor…</p>}
              {list.state === 'fail' && <p className="py-8 text-center text-sm font-bold text-rose-400">{list.message}</p>}
              {list.state === 'done' && list.items.length >= 100 && <p className="text-[11px] text-amber-400">En fazla 100 kayıt gösterilir; daha kısa bir aralık seçin.</p>}
              {list.state === 'done' && shownList.length === 0 && <p className="py-10 text-center text-sm text-stone-400">{list.items.length ? 'Aramaya uyan fatura yok.' : 'Bu dönemde fatura yok.'}</p>}
              {list.state === 'done' && shownList.map(inv => {
                const waiting = tab === 'in' && needsReply(inv);
                const [, label, cls] = waiting ? [null, 'Yanıt bekliyor', 'bg-amber-500/15 text-amber-400 border-amber-500/30'] : statusOf(inv.status);
                const title = tab === 'out' ? inv.customer : inv.supplier;
                return (
                  <button
                    key={inv.uuid}
                    type="button"
                    onClick={() => void openInvoice(inv.uuid, inv.id || title, tab === 'out' ? 'OUT' : 'IN', inv)}
                    className={`w-full text-left rounded-2xl border bg-stone-950/40 p-3 flex items-center gap-3 active:scale-[0.99] transition-transform ${waiting ? 'border-amber-500/40' : 'border-white/10'}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-stone-100 truncate">{title || '—'}</p>
                      <p className="text-[11px] text-stone-400 truncate mt-0.5">
                        {trDate(inv.issueDate)} · {inv.id || 'Numara bekliyor'} · {inv.profile === 'EARSIVFATURA' ? 'e-Arşiv' : 'e-Fatura'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-extrabold text-stone-100 tabular-nums">{tl(inv.payableAmount)}</p>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${cls}`}>{label}</span>
                    </div>
                  </button>
                );
              })}
            </>
          )}

          {viewer && (
            <div className="space-y-2">
              <button type="button" onClick={() => setViewer(null)} className="min-h-[40px] px-3 rounded-xl bg-stone-800 text-stone-200 text-xs font-bold flex items-center gap-1.5">
                <ArrowLeft size={14} /> Geri · <span className="font-mono">{viewer.title}</span>
              </button>
              {viewer.state === 'busy' && <p className="py-10 text-center text-sm text-stone-400 flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> Fatura açılıyor…</p>}
              {viewer.state === 'fail' && <p className="py-8 text-center text-sm font-bold text-rose-400">{viewer.message}</p>}
              {viewer.inv && (() => {
                const inv = viewer.inv;
                const cancelled = /CANCEL/i.test(inv.status);
                const canCancel = viewer.direction === 'OUT' && inv.profile === 'EARSIVFATURA' && !cancelled;
                const canReturn = viewer.direction === 'OUT' && !cancelled && !!inv.id;
                const canRespond = viewer.direction === 'IN' && needsReply(inv);
                if (action.message) return <p className={`rounded-xl px-3 py-2 text-xs font-bold ${action.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{action.message}</p>;
                if (action.kind) {
                  return (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
                      <p className="text-xs text-stone-200">
                        <b>{inv.id || viewer.title}</b> numaralı fatura {action.kind === 'cancel' ? 'iptal edilecek' : action.kind === 'accept' ? 'kabul edilecek' : 'reddedilecek'}. Bu işlem geri alınamaz.
                      </p>
                      <div className="flex gap-2">
                        <button type="button" disabled={action.busy} onClick={() => setAction({ kind: null })} className="flex-1 min-h-[44px] rounded-xl bg-stone-800 text-stone-200 text-sm font-bold">Vazgeç</button>
                        <button type="button" disabled={action.busy} onClick={() => void runAction()} className={`flex-1 min-h-[44px] rounded-xl text-white text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-60 ${action.kind === 'accept' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                          {action.busy && <Loader2 size={15} className="animate-spin" />} {action.kind === 'cancel' ? 'Evet, İptal Et' : action.kind === 'accept' ? 'Evet, Kabul Et' : 'Evet, Reddet'}
                        </button>
                      </div>
                    </div>
                  );
                }
                if (!canCancel && !canRespond && !canReturn) return null;
                return (
                  <div className="flex gap-2">
                    {canRespond && <button type="button" onClick={() => setAction({ kind: 'accept' })} className="flex-1 min-h-[44px] rounded-xl bg-emerald-600 text-white text-sm font-bold flex items-center justify-center gap-1.5"><Check size={16} /> Kabul Et</button>}
                    {canRespond && <button type="button" onClick={() => setAction({ kind: 'reject' })} className="flex-1 min-h-[44px] rounded-xl bg-rose-600/15 border border-rose-500/40 text-rose-400 text-sm font-bold">Reddet</button>}
                    {canReturn && (
                      <button type="button" disabled={returnBusy} onClick={() => void startReturnFrom(inv)} className="flex-1 min-h-[44px] rounded-xl bg-stone-800 border border-white/10 text-stone-100 text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-60">
                        {returnBusy ? <Loader2 size={15} className="animate-spin" /> : <Undo2 size={15} />} İade Faturası Kes
                      </button>
                    )}
                    {canCancel && <button type="button" onClick={() => setAction({ kind: 'cancel' })} className="flex-1 min-h-[44px] rounded-xl bg-rose-600/15 border border-rose-500/40 text-rose-400 text-sm font-bold">İptal Et</button>}
                  </div>
                );
              })()}
              {viewer.state === 'done' && (
                <iframe title="Fatura görüntüsü" sandbox="" srcDoc={viewer.html} className="v22-x w-full h-[68dvh] rounded-xl bg-white border border-white/10" />
              )}
            </div>
          )}

          {/* ---------------- AYARLAR ---------------- */}
          {tab === 'settings' && !viewer && (
            <>
              {(!hasCreds || !hasCompany) && (
                <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-400">Fatura kesebilmek için aşağıdaki bilgileri bir kez doldurun.</p>
              )}
              <section className={cardCls}>
                <h3 className="text-sm font-extrabold text-stone-100">EDM hesabı</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className={labelCls}>EDM kullanıcı adı</label>
                    <input value={cfg.username} onChange={e => updateCfg({ username: e.target.value })} autoCapitalize="none" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>EDM şifresi</label>
                    <input type="password" value={cfg.password || ''} onChange={e => updateCfg({ password: e.target.value })} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Ortam</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['TEST', 'LIVE'] as const).map(env => (
                      <button key={env} type="button" onClick={() => { updateCfg({ edmEnv: env }); setConn({ state: 'idle' }); }} aria-pressed={(cfg.edmEnv || 'TEST') === env}
                        className={`min-h-[44px] rounded-xl text-xs font-bold border ${(cfg.edmEnv || 'TEST') === env ? (env === 'LIVE' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-amber-600 text-white border-amber-500') : 'bg-stone-950 text-stone-400 border-white/15'}`}>
                        {env === 'TEST' ? 'Test (deneme)' : 'Canlı (resmî fatura)'}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-stone-400 mt-1.5">
                    {isLive ? 'Canlı ortamda gönderilen her fatura resmîdir ve kontör harcar.' : 'Test ortamında kesilen faturalar resmî değildir; deneme içindir.'} Şifre cihaza kaydedilmez, uygulama kapanınca silinir.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => void testConnection()} disabled={conn.state === 'busy'} className="min-h-[44px] px-4 rounded-xl bg-indigo-600 text-white text-xs font-bold disabled:opacity-60">
                    {conn.state === 'busy' ? 'Deneniyor…' : 'Bağlantıyı Test Et'}
                  </button>
                  {conn.state === 'ok' && <p className="text-xs font-bold text-emerald-400">✓ {conn.message}</p>}
                  {conn.state === 'fail' && <p className="text-xs font-bold text-rose-400">✕ {conn.message}</p>}
                </div>
              </section>

              <section className={cardCls}>
                <h3 className="text-sm font-extrabold text-stone-100">Firma bilgileri <span className="text-[11px] font-bold text-stone-400">(faturada görünür)</span></h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Firma ünvanı / Ad Soyad</label>
                    <input value={cfg.companyTitle} onChange={e => updateCfg({ companyTitle: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Vergi No / TC Kimlik No</label>
                    <input value={cfg.companyVknOrTc} inputMode="numeric" onChange={e => updateCfg({ companyVknOrTc: digits(e.target.value).slice(0, 11) })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Vergi dairesi</label>
                    <input value={cfg.companyTaxOffice || ''} onChange={e => updateCfg({ companyTaxOffice: e.target.value })} className={inputCls} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Adres</label>
                    <input value={cfg.companyAddress || ''} onChange={e => updateCfg({ companyAddress: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>İlçe</label>
                    <input value={cfg.companyDistrict || ''} onChange={e => updateCfg({ companyDistrict: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>İl</label>
                    <input value={cfg.companyCity || ''} onChange={e => updateCfg({ companyCity: e.target.value })} className={inputCls} />
                  </div>
                </div>
              </section>

              {hasCreds && hasCompany && (
                <button type="button" onClick={() => setTab('issue')} className="w-full min-h-[48px] rounded-xl bg-emerald-600 text-white text-sm font-extrabold flex items-center justify-center gap-2">
                  <FileText size={16} /> Fatura Kesmeye Başla
                </button>
              )}
              <button type="button" onClick={() => { onClose(); (window as any).mks_open_edm?.('warehouses'); }} className="w-full min-h-[42px] rounded-xl bg-stone-800 text-stone-300 text-xs font-bold flex items-center justify-center gap-1.5">
                <Warehouse size={14} /> e-Fatura stok deposu ve taslak kayıtlar
              </button>
            </>
          )}
        </div>

        {/* Sabit alt çubuk: toplam + gönder */}
        {showIssueForm && (
          <div className="shrink-0 border-t border-white/10 bg-stone-900 px-3 sm:px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2">
            {sendError && <p className="text-xs font-bold text-rose-400">{sendError}</p>}
            {confirming ? (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
                <p className="text-xs text-stone-200">
                  <b>{custName.trim()}</b> adına <b>{tl(calc.total)}</b> tutarında <b>{docLabel}</b> {isLive ? <b>resmî olarak</b> : 'test ortamında'} kesilecek.
                  {linkedSale ? ` ${linkedSale.prescriptionNo} kaydına işlenecek.` : willRecord ? ' Stok ve cari hesaba işlenecek.' : ' Stok ve cariye işlenmeyecek.'}
                  {isLive && ' Kesilen fatura geri alınamaz; yalnızca iptal/iade edilebilir.'}
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setConfirming(false)} disabled={sending} className="flex-1 min-h-[46px] rounded-xl bg-stone-800 text-stone-200 text-sm font-bold">Vazgeç</button>
                  <button type="button" onClick={() => void doSend()} disabled={sending} className="flex-1 min-h-[46px] rounded-xl bg-emerald-600 text-white text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-60">
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {sending ? 'Kesiliyor…' : 'Evet, Kes'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] text-stone-400 leading-tight">Toplam · KDV {tl(calc.tax)}</p>
                  <p className="text-lg font-extrabold text-stone-100 tabular-nums leading-tight">{tl(calc.total)}</p>
                </div>
                <button type="button" onClick={() => void startSend()} disabled={payer.state === 'busy'} className={`flex-1 min-h-[50px] rounded-xl text-white text-sm font-extrabold flex items-center justify-center gap-2 disabled:opacity-60 ${kind === 'IADE' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
                  {payer.state === 'busy' ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />} {kind === 'IADE' ? 'İade Faturası Kes' : 'Faturayı Kes'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default EFaturaPanel;

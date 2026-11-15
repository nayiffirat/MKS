import React, { useMemo, useState } from 'react';
import { useAppViewModel } from '../context/AppContext';
import { Reminder } from '../types';
import {
  Calendar,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  ArrowLeft,
  Repeat,
  Users,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Sparkles,
  Check,
  Edit2,
  Clock,
  CalendarClock,
  MapPin,
  AlignLeft,
  Wallet,
  Sprout,
  CheckCheck,
  ArrowUpRight,
  CalendarCheck2,
  X,
} from 'lucide-react';
import { ModalCloseButton } from './ModalCloseButton';
import { useBackHandler } from '../utils/navigationManager';
import { formatCurrency } from '../utils/currency';

interface RemindersScreenProps {
  onBack: () => void;
  initialAddMode?: boolean;
  initialFilter?: 'ALL' | 'PENDING' | 'COMPLETED' | 'TOMORROW';
}

type AgendaFilter =
  | 'PENDING'
  | 'TODAY_OVERDUE'
  | 'TOMORROW'
  | 'FINANCE'
  | 'COMPLETED'
  | 'ALL';

interface FinanceDueItem {
  id: string;
  kind: 'PAYMENT' | 'PRESCRIPTION';
  title: string;
  partyName: string;
  amount: number;
  dueDate: string;
  subtitle: string;
}

interface QuickTemplate {
  label: string;
  title: string;
  priority: Reminder['priority'];
  desc: string;
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeDateKey(raw?: string): string {
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? '' : toDateKey(parsed);
}

function diffCalendarDays(targetKey: string, baseKey: string): number {
  if (!targetKey || !baseKey) return 0;
  const [ty, tm, td] = targetKey.split('-').map(Number);
  const [by, bm, bd] = baseKey.split('-').map(Number);
  const tUtc = Date.UTC(ty, (tm || 1) - 1, td || 1);
  const bUtc = Date.UTC(by, (bm || 1) - 1, bd || 1);
  return Math.round((tUtc - bUtc) / 86_400_000);
}

export const RemindersScreen: React.FC<RemindersScreenProps> = ({
  onBack,
  initialAddMode,
  initialFilter,
}) => {
  const {
    reminders,
    addReminder,
    toggleReminder,
    deleteReminder,
    editReminder,
    farmers,
    myPayments,
    prescriptions,
    visits,
    userProfile,
    t,
    language,
    showToast,
  } = useAppViewModel();

  const farmerLabel = t('label.farmer') || 'Çiftçi';
  const farmerPluralLabel = t('label.farmers') || 'Çiftçiler';
  const currency = userProfile?.currency || 'TRY';
  const dateLocale =
    language === 'tr' ? 'tr-TR' : language === 'en' ? 'en-US' : 'ar-SA';

  const todayStr = toDateKey(new Date());
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toDateKey(d);
  }, []);

  const [isAddModalOpen, setIsAddModalOpen] = useState(initialAddMode || false);
  const [filter, setFilter] = useState<AgendaFilter>(initialFilter || 'PENDING');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | Reminder['priority']>('ALL');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Detail View State
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);

  useBackHandler(
    !!selectedReminder,
    () => setSelectedReminder(null),
    'Reminders_detail',
    50
  );
  useBackHandler(
    isAddModalOpen,
    () => setIsAddModalOpen(false),
    'Reminders_addEdit',
    50
  );

  // Add/Edit Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [creatingFinanceIds, setCreatingFinanceIds] = useState<Record<string, boolean>>({});
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDate, setNewDate] = useState(todayStr);
  const [newPriority, setNewPriority] = useState<Reminder['priority']>('MEDIUM');
  const [newRecurrence, setNewRecurrence] = useState<Reminder['recurrence']>('NONE');
  const [selectedFarmerIds, setSelectedFarmerIds] = useState<string[]>([]);
  const [farmerSearch, setFarmerSearch] = useState('');

  const QUICK_TEMPLATES: QuickTemplate[] = useMemo(
    () => [
      {
        label: 'Saha & Tarla Kontrolü',
        title: t('reminders.presets.control') || 'Saha & Tarla Kontrolü',
        priority: 'MEDIUM',
        desc: 'Fenolojik gelişim, hastalık/zararlı durumu ve tarla gözlemi.',
      },
      {
        label: 'İlaçlama Etkinlik Gözlemi',
        title: t('reminders.presets.spraying') || 'İlaçlama Kontrolü',
        priority: 'HIGH',
        desc: 'Uygulama sonrası etki takibi, doz ve fitotoksisite kontrolü.',
      },
      {
        label: 'Sulama & Gübreleme Planı',
        title: t('reminders.presets.fertilizing') || 'Gübreleme Programı',
        priority: 'MEDIUM',
        desc: 'Bitki besleme takvimi ve damlama/taban gübre dozaj yönlendirmesi.',
      },
      {
        label: `${farmerLabel} Vade & Tahsilat`,
        title: `${farmerLabel} Vade / Tahsilat Görüşmesi`,
        priority: 'HIGH',
        desc: 'Cari bakiye mutabakatı ve ödeme planı hatırlatması.',
      },
      {
        label: 'Depo & SKT / Lot Kontrolü',
        title: 'Depo Stok & SKT / Lot Sayımı',
        priority: 'MEDIUM',
        desc: 'Kritik stok, miat (SKT) ve karekod / GTS bakiye doğrulaması.',
      },
      {
        label: 'Hasat Öncesi Numune',
        title: t('reminders.presets.sampling') || 'Hasat Öncesi Numune',
        priority: 'LOW',
        desc: 'Son ilaçlama aralığı (PHI) ve hasat olgunluk değerlendirmesi.',
      },
    ],
    [farmerLabel, t]
  );

  const TASK_PRESETS = useMemo(
    () => [
      t('reminders.presets.control'),
      t('reminders.presets.spraying'),
      t('reminders.presets.fertilizing'),
      t('reminders.presets.irrigation'),
      t('reminders.presets.visit').replace('[LABEL]', farmerLabel),
      t('reminders.presets.call'),
      t('reminders.presets.harvest'),
      t('reminders.presets.sampling'),
    ],
    [farmerLabel, t]
  );

  const farmerMap = useMemo(() => {
    const map = new Map<string, (typeof farmers)[number]>();
    for (const f of farmers) {
      map.set(f.id, f);
    }
    return map;
  }, [farmers]);

  // Finance & Vade Schedule Items
  const financeItems: FinanceDueItem[] = useMemo(() => {
    const list: FinanceDueItem[] = [];
    for (const p of myPayments) {
      if (p.deletedAt || p.status !== 'PENDING' || !p.dueDate) continue;
      const dueDate = normalizeDateKey(p.dueDate);
      if (!dueDate) continue;
      const partyName = p.supplierName || p.farmerName || 'Cari Hesap';
      const typeLabel =
        p.type === 'CHECK'
          ? 'Çek Vadesi'
          : p.type === 'PROMISSORY_NOTE'
            ? 'Senet Vadesi'
            : p.type === 'CARD_INSTALLMENT' || p.type === 'DEFERRED_CARD'
              ? 'Kart Vadesi'
              : 'Ödeme Planı Vadesi';
      list.push({
        id: `pay_${p.id}`,
        kind: 'PAYMENT',
        title: `${partyName} — ${typeLabel}`,
        partyName,
        amount: Number(p.amount || 0),
        dueDate,
        subtitle:
          p.note || (p.checkSerialNo ? `Seri No: ${p.checkSerialNo}` : typeLabel),
      });
    }

    for (const pr of prescriptions) {
      if (
        pr.deletedAt ||
        pr.priceType !== 'TERM' ||
        !pr.dueDate ||
        pr.status === 'INVOICED'
      ) {
        continue;
      }
      const dueDate = normalizeDateKey(pr.dueDate);
      if (!dueDate) continue;
      const farmer = farmerMap.get(pr.farmerId);
      const partyName = farmer?.fullName || farmerLabel;
      list.push({
        id: `rec_${pr.id}`,
        kind: 'PRESCRIPTION',
        title: `${partyName} — Vadeli Reçete (${pr.prescriptionNo || pr.id.slice(0, 6)})`,
        partyName,
        amount: Number(pr.totalAmount || 0),
        dueDate,
        subtitle: pr.crop ? `Ürün: ${pr.crop}` : 'Vadeli Reçete Vadesi',
      });
    }

    return list.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [myPayments, prescriptions, farmerMap, farmerLabel]);

  // Executive KPIs
  const metrics = useMemo(() => {
    const active = reminders.filter((r) => !r.isCompleted);
    const completed = reminders.filter((r) => r.isCompleted);
    const todayAndOverdue = active.filter(
      (r) => normalizeDateKey(r.date) <= todayStr
    );
    const tomorrow = active.filter(
      (r) => normalizeDateKey(r.date) === tomorrowStr
    );
    const highPriority = active.filter((r) => r.priority === 'HIGH');
    const completionRate =
      reminders.length > 0
        ? Math.round((completed.length / reminders.length) * 100)
        : 0;

    const upcoming30Finance = financeItems.filter((f) => {
      const diff = diffCalendarDays(f.dueDate, todayStr);
      return diff >= -7 && diff <= 30;
    });
    const upcomingFinanceTotal = upcoming30Finance.reduce(
      (sum, f) => sum + f.amount,
      0
    );

    return {
      totalCount: reminders.length,
      pendingCount: active.length,
      completedCount: completed.length,
      todayAndOverdueCount: todayAndOverdue.length,
      tomorrowCount: tomorrow.length,
      highPriorityCount: highPriority.length,
      completionRate,
      upcomingFinanceCount: upcoming30Finance.length,
      upcomingFinanceTotal,
      allFinanceCount: financeItems.length,
    };
  }, [reminders, financeItems, todayStr, tomorrowStr]);

  // Day indicator map for interactive monthly calendar
  const calendarDotMap = useMemo(() => {
    const map = new Map<
      string,
      { urgent: number; normal: number; finance: number }
    >();
    const touch = (dateKey: string) => {
      let entry = map.get(dateKey);
      if (!entry) {
        entry = { urgent: 0, normal: 0, finance: 0 };
        map.set(dateKey, entry);
      }
      return entry;
    };

    for (const r of reminders) {
      if (r.isCompleted) continue;
      const key = normalizeDateKey(r.date);
      if (!key) continue;
      const entry = touch(key);
      if (r.priority === 'HIGH' || key < todayStr) {
        entry.urgent += 1;
      } else {
        entry.normal += 1;
      }
    }

    for (const f of financeItems) {
      const entry = touch(f.dueDate);
      entry.finance += 1;
    }

    return map;
  }, [reminders, financeItems, todayStr]);

  // Month grid cells (Monday-first)
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingBlanks = (firstDay.getDay() + 6) % 7;

    const cells: { key: string; day: number | null }[] = [];
    for (let i = 0; i < leadingBlanks; i++) {
      cells.push({ key: `blank-${i}`, day: null });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const key = toDateKey(new Date(year, month, day));
      cells.push({ key, day });
    }
    return cells;
  }, [currentMonth]);

  const recentVisits = useMemo(() => {
    return visits
      .filter((v) => !v.deletedAt)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 4);
  }, [visits]);

  const normalizedSearch = searchQuery.trim().toLocaleLowerCase('tr-TR');

  const filteredReminders = useMemo(() => {
    return reminders
      .filter((r) => {
        const key = normalizeDateKey(r.date);
        if (selectedDate && key !== selectedDate) return false;

        if (!selectedDate) {
          if (filter === 'PENDING' && r.isCompleted) return false;
          if (filter === 'COMPLETED' && !r.isCompleted) return false;
          if (filter === 'TODAY_OVERDUE' && (r.isCompleted || key > todayStr))
            return false;
          if (filter === 'TOMORROW' && (r.isCompleted || key !== tomorrowStr))
            return false;
          if (filter === 'FINANCE') return false;
        }

        if (priorityFilter !== 'ALL' && r.priority !== priorityFilter) {
          return false;
        }

        if (normalizedSearch) {
          const linkedText = (r.farmerIds || [])
            .map((id) => {
              const fm = farmerMap.get(id);
              return fm ? `${fm.fullName} ${fm.village || ''}` : '';
            })
            .join(' ');
          const haystack = `${r.title} ${r.description || ''} ${linkedText}`.toLocaleLowerCase(
            'tr-TR'
          );
          if (!haystack.includes(normalizedSearch)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
        const da = normalizeDateKey(a.date);
        const db = normalizeDateKey(b.date);
        if (da !== db) return da.localeCompare(db);
        const weight = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        return weight[a.priority] - weight[b.priority];
      });
  }, [
    reminders,
    selectedDate,
    filter,
    priorityFilter,
    normalizedSearch,
    farmerMap,
    todayStr,
    tomorrowStr,
  ]);

  const filteredFinanceItems = useMemo(() => {
    const showFinance =
      filter === 'FINANCE' || filter === 'ALL' || Boolean(selectedDate);
    if (!showFinance) return [];
    return financeItems.filter((item) => {
      if (selectedDate && item.dueDate !== selectedDate) return false;
      if (normalizedSearch) {
        const hay = `${item.title} ${item.partyName} ${item.subtitle}`.toLocaleLowerCase(
          'tr-TR'
        );
        if (!hay.includes(normalizedSearch)) return false;
      }
      return true;
    });
  }, [financeItems, filter, selectedDate, normalizedSearch]);

  const resetForm = (overrideDate?: string) => {
    setEditingId(null);
    setNewTitle('');
    setNewDesc('');
    setNewDate(overrideDate || selectedDate || todayStr);
    setNewPriority('MEDIUM');
    setNewRecurrence('NONE');
    setSelectedFarmerIds([]);
    setFarmerSearch('');
  };

  const openNewTaskModal = (template?: QuickTemplate, overrideDate?: string) => {
    resetForm(overrideDate);
    if (template) {
      setNewTitle(template.title);
      setNewPriority(template.priority);
      setNewDesc(template.desc);
    }
    setIsAddModalOpen(true);
  };

  const handleCreateReminderFromFinance = async (item: FinanceDueItem) => {
    if (creatingFinanceIds[item.id]) return;
    setCreatingFinanceIds(prev => ({ ...prev, [item.id]: true }));
    try {
      await addReminder({
        title: item.title,
        description: `${item.subtitle} • Tutar: ${formatCurrency(item.amount, currency)}`,
        date: item.dueDate,
        isCompleted: false,
        priority: 'HIGH',
        recurrence: 'NONE',
      });
      showToast('Vade kaydı ajandaya görev olarak eklendi.', 'success');
    } catch {
      showToast(t('reminders.error.save'), 'error');
    } finally {
      setCreatingFinanceIds(prev => ({ ...prev, [item.id]: false }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || !newTitle.trim()) return;

    setIsSaving(true);
    try {
      if (editingId) {
        await editReminder(editingId, {
          title: newTitle.trim(),
          description: newDesc.trim(),
          date: newDate,
          priority: newPriority,
          recurrence: newRecurrence,
          farmerIds: selectedFarmerIds.length > 0 ? selectedFarmerIds : undefined,
        });
        showToast('Görev güncellendi.', 'success');
      } else {
        await addReminder({
          title: newTitle.trim(),
          description: newDesc.trim(),
          date: newDate,
          isCompleted: false,
          priority: newPriority,
          farmerIds: selectedFarmerIds.length > 0 ? selectedFarmerIds : undefined,
          recurrence: newRecurrence,
        });
        showToast('Yeni görev ajandaya eklendi.', 'success');
      }
      setIsAddModalOpen(false);
      resetForm();
    } catch (error) {
      console.error('Reminder save error:', error);
      showToast(t('reminders.error.save'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = (reminder: Reminder) => {
    setEditingId(reminder.id);
    setNewTitle(reminder.title);
    setNewDesc(reminder.description || '');
    setNewDate(normalizeDateKey(reminder.date) || todayStr);
    setNewPriority(reminder.priority);
    setNewRecurrence(reminder.recurrence);
    setSelectedFarmerIds(reminder.farmerIds || []);
    setSelectedReminder(null);
    setIsAddModalOpen(true);
  };

  const toggleFarmerSelection = (id: string) => {
    setSelectedFarmerIds((prev) =>
      prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]
    );
  };

  const getPriorityBadgeStyle = (p: Reminder['priority']) => {
    switch (p) {
      case 'HIGH':
        return 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30';
      case 'MEDIUM':
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
      case 'LOW':
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
    }
  };

  const getPriorityStripeClass = (p: Reminder['priority'], isDone: boolean) => {
    if (isDone) return 'bg-slate-400/50';
    switch (p) {
      case 'HIGH':
        return 'bg-rose-500';
      case 'MEDIUM':
        return 'bg-amber-500';
      case 'LOW':
        return 'bg-emerald-500';
    }
  };

  const getRelativeDayBadge = (dateStr: string, isDone: boolean) => {
    const key = normalizeDateKey(dateStr);
    const diff = diffCalendarDays(key, todayStr);
    if (isDone) {
      return {
        label: 'Tamamlandı',
        cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
      };
    }
    if (diff < 0) {
      return {
        label: `${Math.abs(diff)} gün gecikti`,
        cls: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30',
      };
    }
    if (diff === 0) {
      return {
        label: 'Bugün',
        cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
      };
    }
    if (diff === 1) {
      return {
        label: 'Yarın',
        cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
      };
    }
    return {
      label: `${diff} gün sonra`,
      cls: 'bg-slate-500/10 text-[var(--mks-muted)] border-[var(--mks-card-border)]',
    };
  };

  const getRecurrenceLabel = (r: Reminder['recurrence']) => {
    switch (r) {
      case 'DAILY':
        return t('reminders.recurrence.daily');
      case 'WEEKLY':
        return t('reminders.recurrence.weekly');
      case 'MONTHLY':
        return t('reminders.recurrence.monthly');
      default:
        return t('reminders.recurrence.none');
    }
  };

  const getLinkedFarmers = (ids?: string[]) => {
    if (!ids || ids.length === 0) return [];
    return ids.map((id) => farmerMap.get(id)).filter((f): f is NonNullable<typeof f> => Boolean(f));
  };

  const tabItems: { key: AgendaFilter; label: string; count: number; icon?: React.ReactNode }[] = [
    { key: 'PENDING', label: t('reminders.filter.pending') || 'YAPILACAK', count: metrics.pendingCount },
    { key: 'TODAY_OVERDUE', label: 'BUGÜN & ACİL', count: metrics.todayAndOverdueCount },
    {
      key: 'TOMORROW',
      label: t('reminders.filter.tomorrow') || 'YARIN',
      count: metrics.tomorrowCount,
      icon: <CalendarClock size={13} className="shrink-0" />,
    },
    {
      key: 'FINANCE',
      label: 'VADE & FİNANS',
      count: metrics.allFinanceCount,
      icon: <Wallet size={13} className="shrink-0" />,
    },
    { key: 'COMPLETED', label: t('reminders.filter.completed') || 'BİTEN', count: metrics.completedCount },
    { key: 'ALL', label: t('reminders.filter.all') || 'HEPSİ', count: metrics.totalCount + metrics.allFinanceCount },
  ];

  const monthLabel = currentMonth.toLocaleDateString(dateLocale, {
    month: 'long',
    year: 'numeric',
  });

  const selectedDateFormatted = selectedDate
    ? new Date(`${selectedDate}T12:00:00`).toLocaleDateString(dateLocale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : null;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-5 pt-2 pb-28 space-y-5 animate-in fade-in duration-300">
      {/* Executive Header */}
      <div className="v22-bento-card p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="v22-surface-pill min-w-[42px] min-h-[42px] rounded-xl flex items-center justify-center active:scale-95 transition-transform shrink-0"
            aria-label="Geri Dön"
          >
            <ArrowLeft size={18} />
          </button>
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"
            style={{
              background: 'var(--mks-accent-soft)',
              color: 'var(--mks-accent-soft-text)',
            }}
          >
            <CalendarCheck2 size={21} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-[var(--mks-text)] truncate">
              Kurumsal Ajanda ve Görev Merkezi
            </h1>
            <p className="text-xs font-medium text-[var(--mks-muted)] truncate">
              Saha Operasyonları • {farmerLabel} Ziyaret Planı • Vade & Tahsilat Takvimi
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--mks-muted)] pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Görev, köy veya çiftçi ara..."
              className="w-full h-11 pl-10 pr-8 rounded-xl text-xs font-semibold outline-none border transition-colors"
              style={{
                background: 'var(--mks-input-bg)',
                borderColor: 'var(--mks-input-border)',
                color: 'var(--mks-text)',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-[var(--mks-muted)] hover:text-[var(--mks-text)]"
                aria-label="Aramayı temizle"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => openNewTaskModal()}
            className="v22-dark-pill h-11 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all shrink-0"
          >
            <Plus size={16} />
            <span>Yeni Görev Planla</span>
          </button>
        </div>
      </div>

      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => {
            setSelectedDate(null);
            setFilter('TODAY_OVERDUE');
          }}
          className={`v22-bento-card p-4 text-left flex flex-col justify-between gap-2.5 cursor-pointer ${
            filter === 'TODAY_OVERDUE' && !selectedDate
              ? 'ring-2 ring-rose-500/60'
              : ''
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--mks-muted)]">
              Bugün & Geciken
            </span>
            <span className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-500 flex items-center justify-center">
              <AlertCircle size={16} />
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-[var(--mks-text)]">
              {metrics.todayAndOverdueCount}
            </span>
            <span className="text-[11px] font-bold text-rose-500">
              {metrics.highPriorityCount} yüksek öncelik
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setSelectedDate(null);
            setFilter('PENDING');
          }}
          className={`v22-bento-card p-4 text-left flex flex-col justify-between gap-2.5 cursor-pointer ${
            filter === 'PENDING' && !selectedDate
              ? 'ring-2 ring-emerald-500/60'
              : ''
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--mks-muted)]">
              Bekleyen Görevler
            </span>
            <span className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Clock size={16} />
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono text-[var(--mks-text)]">
                {metrics.pendingCount}
              </span>
              <span className="text-[11px] font-semibold text-[var(--mks-muted)]">
                {metrics.tomorrowCount} yarın
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[var(--mks-subcard)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${metrics.completionRate}%`,
                  background: 'var(--mks-accent-primary)',
                }}
              />
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setSelectedDate(null);
            setFilter('FINANCE');
          }}
          className={`v22-bento-card p-4 text-left flex flex-col justify-between gap-2.5 cursor-pointer ${
            filter === 'FINANCE' && !selectedDate
              ? 'ring-2 ring-indigo-500/60'
              : ''
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--mks-muted)]">
              30 Günlük Vade
            </span>
            <span className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Wallet size={16} />
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-black font-mono text-[var(--mks-text)]">
              {metrics.upcomingFinanceCount}
            </span>
            <span className="text-[11px] font-extrabold font-mono text-indigo-600 dark:text-indigo-300 truncate">
              {formatCurrency(metrics.upcomingFinanceTotal, currency)}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setSelectedDate(null);
            setFilter('COMPLETED');
          }}
          className={`v22-bento-card p-4 text-left flex flex-col justify-between gap-2.5 cursor-pointer ${
            filter === 'COMPLETED' && !selectedDate
              ? 'ring-2 ring-emerald-500/60'
              : ''
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--mks-muted)]">
              Tamamlanma Oranı
            </span>
            <span className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <CheckCheck size={16} />
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-[var(--mks-text)]">
              %{metrics.completionRate}
            </span>
            <span className="text-[11px] font-semibold text-[var(--mks-muted)]">
              {metrics.completedCount} tamamlandı
            </span>
          </div>
        </button>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left/Main Column */}
        <div className="lg:col-span-8 space-y-4">
          {/* Filter Tabs + Priority Filters */}
          <div className="v22-bento-card p-3 sm:p-4 space-y-3">
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {tabItems.map((tab) => {
                const isActive = !selectedDate && filter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setSelectedDate(null);
                      setFilter(tab.key);
                    }}
                    className={`min-h-[38px] px-3 py-1.5 rounded-xl text-[11px] font-extrabold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 border ${
                      isActive
                        ? 'v22-dark-pill border-transparent shadow-sm'
                        : 'bg-[var(--mks-subcard)] hover:bg-[var(--mks-subcard-hover)] text-[var(--mks-muted)] border-[var(--mks-card-border)]'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-black/5 dark:bg-white/10 text-[var(--mks-text)]'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--mks-card-border)]">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--mks-muted)] mr-1">
                  Öncelik:
                </span>
                {(
                  [
                    { k: 'ALL', label: 'Tümü' },
                    { k: 'HIGH', label: t('reminders.priority.high') || 'Yüksek' },
                    { k: 'MEDIUM', label: t('reminders.priority.medium') || 'Orta' },
                    { k: 'LOW', label: t('reminders.priority.low') || 'Düşük' },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.k}
                    type="button"
                    onClick={() => setPriorityFilter(p.k)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                      priorityFilter === p.k
                        ? 'border-transparent text-white shadow-sm'
                        : 'bg-[var(--mks-subcard)] text-[var(--mks-muted)] border-[var(--mks-card-border)] hover:text-[var(--mks-text)]'
                    }`}
                    style={
                      priorityFilter === p.k
                        ? { background: 'var(--mks-accent-primary)' }
                        : undefined
                    }
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {selectedDate && (
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold"
                    style={{
                      background: 'var(--mks-accent-soft)',
                      color: 'var(--mks-accent-soft-text)',
                    }}
                  >
                    <Calendar size={12} />
                    <span>{selectedDateFormatted}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedDate(null)}
                      className="ml-0.5 hover:opacity-75"
                      aria-label="Tarih filtresini temizle"
                    >
                      <X size={12} />
                    </button>
                  </span>
                  <button
                    type="button"
                    onClick={() => openNewTaskModal(undefined, selectedDate)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
                  >
                    + Bu Güne Ekle
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Quick Agricultural & Corporate Templates Strip */}
          <div className="v22-bento-card p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-1.5">
                <Sparkles size={14} style={{ color: 'var(--mks-accent-primary)' }} />
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--mks-text)]">
                  Hızlı Zirai & Kurumsal Görev Şablonları
                </span>
              </div>
              <span className="text-[10px] font-medium text-[var(--mks-muted)] hidden sm:inline">
                Tek tıkla ön-doldurulmuş görev oluşturun
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  onClick={() => openNewTaskModal(tpl)}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-bold border border-[var(--mks-card-border)] bg-[var(--mks-subcard)] hover:bg-[var(--mks-subcard-hover)] text-[var(--mks-text)] flex items-center gap-1.5 transition-all active:scale-95"
                >
                  <Plus size={12} style={{ color: 'var(--mks-accent-primary)' }} />
                  <span>{tpl.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Task & Finance Cards */}
          <div className="space-y-3">
            {filteredReminders.map((item) => {
              const rel = getRelativeDayBadge(item.date, item.isCompleted);
              const linkedFarmers = getLinkedFarmers(item.farmerIds);

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedReminder(item)}
                  className={`v22-bento-card p-4 relative overflow-hidden cursor-pointer ${
                    item.isCompleted ? 'opacity-70' : ''
                  }`}
                >
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1.5 ${getPriorityStripeClass(
                      item.priority,
                      item.isCompleted
                    )}`}
                  />

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pl-2">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleReminder(item.id);
                        }}
                        aria-label={
                          item.isCompleted ? 'Bekleyenlere al' : 'Görevi tamamla'
                        }
                        className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 shrink-0 transition-all active:scale-90 ${
                          item.isCompleted
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                            : 'bg-[var(--mks-subcard)] border-[var(--mks-card-border)] text-[var(--mks-muted)] hover:border-emerald-500/60'
                        }`}
                      >
                        {item.isCompleted ? (
                          <Check size={18} strokeWidth={3} />
                        ) : (
                          <Circle size={18} />
                        )}
                      </button>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3
                            className={`text-sm font-extrabold text-[var(--mks-text)] tracking-tight ${
                              item.isCompleted ? 'line-through opacity-65' : ''
                            }`}
                          >
                            {item.title}
                          </h3>
                          {!item.isCompleted && (
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-md border font-black uppercase tracking-wider ${getPriorityBadgeStyle(
                                item.priority
                              )}`}
                            >
                              {item.priority === 'HIGH'
                                ? t('reminders.priority.high')
                                : item.priority === 'MEDIUM'
                                  ? t('reminders.priority.medium')
                                  : t('reminders.priority.low')}
                            </span>
                          )}
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-md border font-bold ${rel.cls}`}
                          >
                            {rel.label}
                          </span>
                        </div>

                        {item.description && (
                          <p className="text-xs text-[var(--mks-muted)] line-clamp-2 leading-relaxed">
                            {item.description}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          <span className="inline-flex items-center text-[11px] font-bold text-[var(--mks-muted)]">
                            <Calendar size={12} className="mr-1" />
                            {new Date(
                              `${normalizeDateKey(item.date)}T12:00:00`
                            ).toLocaleDateString(dateLocale, {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>

                          {item.recurrence !== 'NONE' && (
                            <span className="inline-flex items-center text-[11px] font-bold text-sky-600 dark:text-sky-400">
                              <Repeat size={12} className="mr-1" />
                              {getRecurrenceLabel(item.recurrence)}
                            </span>
                          )}

                          {linkedFarmers.map((f) => (
                            <span
                              key={f.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border border-[var(--mks-card-border)] bg-[var(--mks-subcard)] text-[var(--mks-text)]"
                            >
                              <Users size={10} />
                              <span>{f.fullName}</span>
                              {f.village && (
                                <span className="text-[var(--mks-muted)]">
                                  ({f.village})
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-1.5 shrink-0 pl-12 sm:pl-0">
                      {!item.isCompleted && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleReminder(item.id);
                          }}
                          className="px-3 py-2 rounded-xl bg-emerald-600/15 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-300 hover:text-white border border-emerald-500/30 text-[11px] font-extrabold flex items-center gap-1.5 transition-all active:scale-95"
                        >
                          <CheckCircle2 size={14} />
                          <span>{t('reminders.action.finish') || 'Tamamla'}</span>
                        </button>
                      )}
                      {!item.isCompleted && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(item);
                          }}
                          aria-label="Görevi düzenle"
                          className="p-2 rounded-xl bg-[var(--mks-subcard)] hover:bg-[var(--mks-subcard-hover)] border border-[var(--mks-card-border)] text-[var(--mks-muted)] hover:text-[var(--mks-text)] transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(t('reminders.action.delete_confirm'))) {
                            deleteReminder(item.id);
                          }
                        }}
                        aria-label="Görevi sil"
                        className="p-2 rounded-xl bg-[var(--mks-subcard)] hover:bg-rose-500/15 border border-[var(--mks-card-border)] text-[var(--mks-muted)] hover:text-rose-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Automated Financial / Vade Cards */}
            {filteredFinanceItems.map((fin) => {
              const rel = getRelativeDayBadge(fin.dueDate, false);
              return (
                <div
                  key={fin.id}
                  className="v22-bento-card p-4 relative overflow-hidden"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500" />
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pl-2">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">
                        <Wallet size={18} />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-extrabold text-[var(--mks-text)]">
                            {fin.title}
                          </h3>
                          <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25 text-[10px] font-black uppercase">
                            Otomatik Vade
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-md border font-bold ${rel.cls}`}
                          >
                            {rel.label}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--mks-muted)]">
                          {fin.subtitle} • Vade:{' '}
                          {new Date(`${fin.dueDate}T12:00:00`).toLocaleDateString(
                            dateLocale,
                            { day: 'numeric', month: 'short', year: 'numeric' }
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pl-12 sm:pl-0 shrink-0">
                      <span className="text-sm font-black font-mono text-[var(--mks-text)]">
                        {formatCurrency(fin.amount, currency)}
                      </span>
                      <button
                        type="button"
                        disabled={!!creatingFinanceIds[fin.id]}
                        onClick={() => handleCreateReminderFromFinance(fin)}
                        className="px-3 py-2 rounded-xl bg-[var(--mks-subcard)] hover:bg-[var(--mks-subcard-hover)] border border-[var(--mks-card-border)] text-[var(--mks-text)] text-[11px] font-extrabold flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                      >
                        <ArrowUpRight size={13} />
                        <span>{creatingFinanceIds[fin.id] ? 'Ekleniyor...' : 'Göreve Dönüştür'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Rich Corporate Empty State */}
            {filteredReminders.length === 0 && filteredFinanceItems.length === 0 && (
              <div className="v22-bento-card p-8 sm:p-10 text-center space-y-5">
                <div
                  className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center shadow-sm"
                  style={{
                    background: 'var(--mks-accent-soft)',
                    color: 'var(--mks-accent-soft-text)',
                  }}
                >
                  <CalendarCheck2 size={28} />
                </div>

                <div className="max-w-md mx-auto space-y-1.5">
                  <h3 className="text-base font-extrabold text-[var(--mks-text)]">
                    {selectedDate
                      ? `${selectedDateFormatted} için planlanmış kayıt yok`
                      : filter === 'TOMORROW'
                        ? t('reminders.no_plan.tomorrow') || 'Yarın için planlanmış görev bulunmuyor.'
                        : filter === 'FINANCE'
                          ? 'Bekleyen vade veya ödeme planı kaydı bulunmuyor.'
                          : 'Bu görünümde bekleyen görev bulunmuyor'}
                  </h3>
                  <p className="text-xs text-[var(--mks-muted)] leading-relaxed">
                    Tarla kontrolü, ilaçlama takibi veya {farmerLabel.toLowerCase()} tahsilat görüşmesi planlayarak günlük operasyonlarınızı buradan yönetebilirsiniz.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => openNewTaskModal()}
                    className="v22-dark-pill px-4 py-2.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform"
                  >
                    <Plus size={15} />
                    <span>İlk Görevi Planla</span>
                  </button>
                  {QUICK_TEMPLATES.slice(0, 3).map((tpl) => (
                    <button
                      key={`empty-${tpl.label}`}
                      type="button"
                      onClick={() => openNewTaskModal(tpl)}
                      className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-[var(--mks-subcard)] hover:bg-[var(--mks-subcard-hover)] border border-[var(--mks-card-border)] text-[var(--mks-text)] transition-colors"
                    >
                      + {tpl.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar Column */}
        <div className="lg:col-span-4 space-y-4">
          {/* Interactive Monthly Calendar Card */}
          <div className="v22-bento-card p-4 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Calendar size={16} style={{ color: 'var(--mks-accent-primary)' }} />
                <h2 className="text-sm font-extrabold capitalize text-[var(--mks-text)] truncate">
                  {monthLabel}
                </h2>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                    setSelectedDate(todayStr);
                  }}
                  className="px-2 py-1 rounded-lg text-[10px] font-extrabold bg-[var(--mks-subcard)] hover:bg-[var(--mks-subcard-hover)] text-[var(--mks-text)] border border-[var(--mks-card-border)]"
                >
                  Bugün
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentMonth(
                      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                    )
                  }
                  aria-label="Önceki ay"
                  className="p-1.5 rounded-lg bg-[var(--mks-subcard)] hover:bg-[var(--mks-subcard-hover)] text-[var(--mks-text)] border border-[var(--mks-card-border)]"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentMonth(
                      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                    )
                  }
                  aria-label="Sonraki ay"
                  className="p-1.5 rounded-lg bg-[var(--mks-subcard)] hover:bg-[var(--mks-subcard-hover)] text-[var(--mks-text)] border border-[var(--mks-card-border)]"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((d) => (
                <div
                  key={d}
                  className="text-[10px] font-extrabold uppercase text-[var(--mks-muted)] py-1"
                >
                  {d}
                </div>
              ))}

              {calendarDays.map((cell) => {
                if (cell.day === null) {
                  return <div key={cell.key} className="h-9" />;
                }
                const dots = calendarDotMap.get(cell.key);
                const isToday = cell.key === todayStr;
                const isSelected = cell.key === selectedDate;
                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() =>
                      setSelectedDate((prev) =>
                        prev === cell.key ? null : cell.key
                      )
                    }
                    className={`h-9 rounded-xl flex flex-col items-center justify-center relative text-xs font-bold transition-all border ${
                      isSelected
                        ? 'v22-dark-pill border-transparent shadow-sm'
                        : isToday
                          ? 'bg-[var(--mks-accent-soft)] text-[var(--mks-accent-soft-text)] border-emerald-500/40 font-black'
                          : 'bg-transparent hover:bg-[var(--mks-subcard)] text-[var(--mks-text)] border-transparent'
                    }`}
                  >
                    <span>{cell.day}</span>
                    {dots && (dots.urgent > 0 || dots.normal > 0 || dots.finance > 0) && (
                      <div className="flex items-center gap-0.5 mt-0.5">
                        {dots.urgent > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        )}
                        {dots.normal > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        )}
                        {dots.finance > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--mks-card-border)] text-[10px] font-semibold text-[var(--mks-muted)]">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500" /> Acil
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Görev
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" /> Vade
                </span>
              </div>
              <button
                type="button"
                onClick={() => openNewTaskModal(undefined, selectedDate || todayStr)}
                className="font-extrabold hover:underline"
                style={{ color: 'var(--mks-accent-primary)' }}
              >
                + {selectedDate ? 'Seçili Güne Ekle' : 'Bugüne Ekle'}
              </button>
            </div>
          </div>

          {/* Recent Field Visits & Activity Summary */}
          <div className="v22-bento-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sprout size={16} style={{ color: 'var(--mks-accent-primary)' }} />
                <h2 className="text-sm font-extrabold text-[var(--mks-text)]">
                  Son Saha Ziyaretleri
                </h2>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[var(--mks-subcard)] text-[var(--mks-muted)]">
                {visits.filter((v) => !v.deletedAt).length} kayıt
              </span>
            </div>

            {recentVisits.length === 0 ? (
              <div className="p-4 rounded-xl bg-[var(--mks-subcard)] text-center text-xs text-[var(--mks-muted)]">
                Henüz kaydedilmiş tarla ziyareti bulunmuyor.
              </div>
            ) : (
              <div className="space-y-2">
                {recentVisits.map((v) => {
                  const farmer = farmerMap.get(v.farmerId);
                  const visitKey = normalizeDateKey(v.date);
                  const tag = v.pestFound || v.diseaseFound;
                  return (
                    <div
                      key={v.id}
                      className="p-3 rounded-xl bg-[var(--mks-subcard)] border border-[var(--mks-card-border)] space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-[var(--mks-text)] truncate">
                          {farmer?.fullName || farmerLabel}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-[var(--mks-muted)] shrink-0">
                          {visitKey
                            ? new Date(`${visitKey}T12:00:00`).toLocaleDateString(
                                dateLocale,
                                { day: 'numeric', month: 'short' }
                              )
                            : '-'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(v.village || farmer?.village) && (
                          <span className="inline-flex items-center text-[10px] font-semibold text-[var(--mks-muted)]">
                            <MapPin size={10} className="mr-0.5" />
                            {v.village || farmer?.village}
                          </span>
                        )}
                        {tag && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                            {tag}
                          </span>
                        )}
                      </div>
                      {v.note && (
                        <p className="text-[11px] text-[var(--mks-muted)] line-clamp-1">
                          {v.note}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DETAIL MODAL */}
      {selectedReminder && (
        <div
          className="fixed inset-0 bg-black/65 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedReminder(null);
          }}
        >
          <div
            className="v22-bento-card w-full max-w-md relative overflow-hidden flex flex-col max-h-[90dvh]"
            style={{
              background: 'var(--mks-modal-bg)',
              borderColor: 'var(--mks-card-border)',
              color: 'var(--mks-text)',
            }}
          >
            <div
              className={`h-2 w-full ${getPriorityStripeClass(
                selectedReminder.priority,
                selectedReminder.isCompleted
              )}`}
            />

            <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
              <div className="flex justify-between items-start gap-3">
                <div className="space-y-1.5 min-w-0">
                  <h3 className="text-lg font-extrabold leading-tight text-[var(--mks-text)]">
                    {selectedReminder.title}
                  </h3>
                  <span
                    className={`inline-block text-[10px] px-2 py-0.5 rounded-md border font-black uppercase tracking-wider ${
                      selectedReminder.isCompleted
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                        : getPriorityBadgeStyle(selectedReminder.priority)
                    }`}
                  >
                    {selectedReminder.isCompleted
                      ? t('reminders.action.finished') || 'Tamamlandı'
                      : selectedReminder.priority === 'HIGH'
                        ? t('reminders.priority.high')
                        : selectedReminder.priority === 'MEDIUM'
                          ? t('reminders.priority.medium')
                          : t('reminders.priority.low')}
                  </span>
                </div>
                <ModalCloseButton
                  onClick={() => setSelectedReminder(null)}
                  className="!rounded-full"
                />
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-[var(--mks-subcard)] border border-[var(--mks-card-border)]">
                  <div className="flex items-center text-[var(--mks-muted)] text-xs font-bold mb-1">
                    <Calendar size={14} className="mr-2 text-emerald-500" />
                    {t('reminders.label.date')}
                  </div>
                  <p className="text-[var(--mks-text)] text-sm font-bold pl-6">
                    {new Date(
                      `${normalizeDateKey(selectedReminder.date)}T12:00:00`
                    ).toLocaleDateString(dateLocale, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>

                {selectedReminder.description && (
                  <div className="p-3.5 rounded-xl bg-[var(--mks-subcard)] border border-[var(--mks-card-border)]">
                    <div className="flex items-center text-[var(--mks-muted)] text-xs font-bold mb-1">
                      <AlignLeft size={14} className="mr-2 text-sky-500" />
                      {t('reminders.label.notes')}
                    </div>
                    <p className="text-[var(--mks-text)] text-xs leading-relaxed pl-6 whitespace-pre-wrap">
                      {selectedReminder.description}
                    </p>
                  </div>
                )}

                {selectedReminder.farmerIds && selectedReminder.farmerIds.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-[var(--mks-subcard)] border border-[var(--mks-card-border)]">
                    <div className="flex items-center text-[var(--mks-muted)] text-xs font-bold mb-2">
                      <Users size={14} className="mr-2 text-amber-500" />
                      İlgili {farmerPluralLabel}
                    </div>
                    <div className="pl-6 space-y-1.5">
                      {getLinkedFarmers(selectedReminder.farmerIds).map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center justify-between text-xs text-[var(--mks-text)] font-semibold"
                        >
                          <span>{f.fullName}</span>
                          {f.village && (
                            <span className="text-[11px] text-[var(--mks-muted)] inline-flex items-center">
                              <MapPin size={10} className="mr-1" />
                              {f.village}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    toggleReminder(selectedReminder.id);
                    setSelectedReminder(null);
                  }}
                  className={`col-span-2 py-3 rounded-xl font-extrabold text-xs flex items-center justify-center shadow-sm active:scale-95 transition-all ${
                    selectedReminder.isCompleted
                      ? 'bg-[var(--mks-subcard)] text-[var(--mks-text)] border border-[var(--mks-card-border)]'
                      : 'v22-dark-pill'
                  }`}
                >
                  {selectedReminder.isCompleted ? (
                    <Circle size={16} className="mr-2" />
                  ) : (
                    <CheckCircle2 size={16} className="mr-2" />
                  )}
                  {selectedReminder.isCompleted
                    ? t('reminders.filter.pending') || 'Bekleyenlere Al'
                    : t('reminders.action.finish') || 'Tamamla'}
                </button>

                <button
                  type="button"
                  onClick={() => handleEditClick(selectedReminder)}
                  className="py-3 rounded-xl bg-[var(--mks-subcard)] hover:bg-[var(--mks-subcard-hover)] text-[var(--mks-text)] font-bold text-xs flex items-center justify-center border border-[var(--mks-card-border)] active:scale-95 transition-all"
                >
                  <Edit2 size={14} className="mr-2" />
                  {t('reminders.action.update') || 'Düzenle'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(t('reminders.action.delete_confirm'))) {
                      deleteReminder(selectedReminder.id);
                      setSelectedReminder(null);
                    }
                  }}
                  className="py-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-300 font-bold text-xs flex items-center justify-center border border-rose-500/30 active:scale-95 transition-all"
                >
                  <Trash2 size={14} className="mr-2" />
                  Sil
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CENTERED CORPORATE ADD/EDIT MODAL */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 bg-black/65 backdrop-blur-sm z-[200] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddModalOpen(false);
          }}
        >
          <div
            className="v22-bento-card w-full max-w-2xl max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl"
            style={{
              background: 'var(--mks-modal-bg)',
              borderColor: 'var(--mks-card-border)',
              color: 'var(--mks-text)',
            }}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center px-5 py-4 border-b border-[var(--mks-card-border)] shrink-0">
              <div>
                <h3 className="text-base font-extrabold tracking-tight text-[var(--mks-text)]">
                  {editingId ? t('reminders.modal.edit') : t('reminders.modal.new')}
                </h3>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--mks-muted)] mt-0.5">
                  {t('reminders.modal.subtitle') || 'Kurumsal Zirai Planlama'}
                </p>
              </div>
              <ModalCloseButton onClick={() => setIsAddModalOpen(false)} />
            </div>

            {/* Scrollable Form */}
            <form
              id="reminder-modal-form"
              onSubmit={handleSave}
              className="flex-1 overflow-y-auto px-5 py-5 space-y-5"
            >
              {/* Title & Quick Presets */}
              <div className="space-y-2">
                <label className="flex items-center text-[11px] font-extrabold text-[var(--mks-muted)] uppercase tracking-wider">
                  <Sparkles size={12} className="mr-1.5 text-emerald-500" />
                  {t('reminders.label.title')}
                </label>
                <input
                  required
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm font-bold outline-none border transition-colors"
                  style={{
                    background: 'var(--mks-input-bg)',
                    borderColor: 'var(--mks-input-border)',
                    color: 'var(--mks-text)',
                  }}
                  placeholder={t('reminders.label.title.placeholder')}
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {TASK_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setNewTitle(preset)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all active:scale-95 ${
                        newTitle === preset
                          ? 'v22-dark-pill border-transparent'
                          : 'bg-[var(--mks-subcard)] text-[var(--mks-muted)] border-[var(--mks-card-border)] hover:text-[var(--mks-text)]'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date & Recurrence */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-extrabold text-[var(--mks-muted)] uppercase tracking-wider block">
                    {t('reminders.label.date')}
                  </label>
                  <div className="relative">
                    <Calendar
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none"
                    />
                    <input
                      required
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="w-full rounded-xl h-12 pl-10 pr-3 text-sm font-bold outline-none border transition-colors"
                      style={{
                        background: 'var(--mks-input-bg)',
                        borderColor: 'var(--mks-input-border)',
                        color: 'var(--mks-text)',
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-extrabold text-[var(--mks-muted)] uppercase tracking-wider block">
                    {t('reminders.label.recurrence')}
                  </label>
                  <div className="relative">
                    <Repeat
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sky-500 pointer-events-none"
                    />
                    <select
                      value={newRecurrence}
                      onChange={(e) => setNewRecurrence(e.target.value as any)}
                      className="w-full rounded-xl h-12 pl-10 pr-9 text-sm font-bold outline-none border appearance-none transition-colors"
                      style={{
                        background: 'var(--mks-input-bg)',
                        borderColor: 'var(--mks-input-border)',
                        color: 'var(--mks-text)',
                      }}
                    >
                      <option value="NONE">{t('reminders.recurrence.none')}</option>
                      <option value="DAILY">{t('reminders.recurrence.daily')}</option>
                      <option value="WEEKLY">{t('reminders.recurrence.weekly')}</option>
                      <option value="MONTHLY">{t('reminders.recurrence.monthly')}</option>
                    </select>
                    <ChevronDown
                      size={16}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--mks-muted)] pointer-events-none"
                    />
                  </div>
                </div>
              </div>

              {/* Priority Selection */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-[var(--mks-muted)] uppercase tracking-wider block">
                  {t('reminders.label.priority')}
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {(['LOW', 'MEDIUM', 'HIGH'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewPriority(p)}
                      className={`py-2.5 rounded-xl text-xs font-extrabold border transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                        newPriority === p
                          ? p === 'HIGH'
                            ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                            : p === 'MEDIUM'
                              ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-sm'
                              : 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                          : 'bg-[var(--mks-subcard)] text-[var(--mks-muted)] border-[var(--mks-card-border)] hover:text-[var(--mks-text)]'
                      }`}
                    >
                      {p === 'HIGH' && <AlertCircle size={13} />}
                      <span>
                        {p === 'HIGH'
                          ? t('reminders.priority.high')
                          : p === 'MEDIUM'
                            ? t('reminders.priority.medium')
                            : t('reminders.priority.low')}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Linked Farmers */}
              <div className="p-3.5 rounded-2xl bg-[var(--mks-subcard)] border border-[var(--mks-card-border)] space-y-2.5">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-extrabold text-[var(--mks-text)] uppercase tracking-wider flex items-center gap-1.5">
                    <Users size={13} style={{ color: 'var(--mks-accent-primary)' }} />
                    <span>
                      {farmerPluralLabel} ({selectedFarmerIds.length})
                    </span>
                  </label>
                  {selectedFarmerIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedFarmerIds([])}
                      className="text-[11px] font-bold text-rose-500 hover:underline"
                    >
                      Seçimi Temizle
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Search
                    size={13}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mks-muted)]"
                  />
                  <input
                    type="text"
                    value={farmerSearch}
                    onChange={(e) => setFarmerSearch(e.target.value)}
                    placeholder={`${farmerLabel} ara...`}
                    className="w-full rounded-xl py-2 pl-8 pr-3 text-xs font-medium outline-none border"
                    style={{
                      background: 'var(--mks-input-bg)',
                      borderColor: 'var(--mks-input-border)',
                      color: 'var(--mks-text)',
                    }}
                  />
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {farmers
                    .filter(
                      (f) =>
                        !f.deletedAt &&
                        f.fullName
                          .toLocaleLowerCase('tr-TR')
                          .includes(farmerSearch.toLocaleLowerCase('tr-TR'))
                    )
                    .map((f) => {
                      const isSelected = selectedFarmerIds.includes(f.id);
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => toggleFarmerSelection(f.id)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'v22-dark-pill border-transparent'
                              : 'bg-[var(--mks-input-bg)] border-[var(--mks-card-border)] text-[var(--mks-text)] hover:bg-[var(--mks-subcard-hover)]'
                          }`}
                        >
                          <div className="min-w-0">
                            <span className="text-xs font-bold block truncate">
                              {f.fullName}
                            </span>
                            {f.village && (
                              <span
                                className={`text-[10px] ${
                                  isSelected ? 'text-white/80' : 'text-[var(--mks-muted)]'
                                }`}
                              >
                                {f.village}
                              </span>
                            )}
                          </div>
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'bg-white border-white text-emerald-700'
                                : 'border-[var(--mks-input-border)]'
                            }`}
                          >
                            {isSelected && <Check size={10} strokeWidth={3} />}
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-[var(--mks-muted)] uppercase tracking-wider block">
                  {t('reminders.label.notes')}
                </label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full rounded-xl p-3 text-xs font-medium outline-none border h-24 resize-none transition-colors"
                  style={{
                    background: 'var(--mks-input-bg)',
                    borderColor: 'var(--mks-input-border)',
                    color: 'var(--mks-text)',
                  }}
                  placeholder={t('reminders.label.notes.placeholder')}
                />
              </div>
            </form>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[var(--mks-card-border)] flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[var(--mks-subcard)] hover:bg-[var(--mks-subcard-hover)] border border-[var(--mks-card-border)] text-[var(--mks-text)] transition-colors"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                form="reminder-modal-form"
                disabled={isSaving || !newTitle.trim()}
                className="v22-dark-pill px-5 py-2.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 shadow-md active:scale-95 transition-all disabled:opacity-50"
              >
                <Check size={15} />
                <span>
                  {isSaving ? 'Kaydediliyor...' : (editingId ? t('reminders.action.update') : t('reminders.action.save'))}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

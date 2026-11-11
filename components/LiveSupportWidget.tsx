import React, { useState, useEffect, useRef } from 'react';
import {
  MessageCircle,
  Send,
  X,
  ShieldCheck,
  Sparkles,
  Phone,
  Mail,
  CheckCircle2,
  Clock,
  User as UserIcon,
  KeyRound,
  Crown
} from 'lucide-react';
import { collection, doc, setDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { getUserSubscriptionTier, SubscriptionTierId } from '../utils/subscriptionManager';
import { useBackHandler, useScrollLock } from '../utils/navigationManager';
import { API_BASE } from '../utils/api';
import { MksBrandLogo } from './MksBrandLogo';

export interface SupportChatMessage {
  id: string;
  sender: 'user' | 'admin';
  senderName: string;
  text: string;
  timestamp: string;
  category?: 'general' | 'subscription' | 'password_reset' | 'bkst_gts';
}

export interface SupportThread {
  threadId: string;
  userUid: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  userTier: SubscriptionTierId;
  updatedAt: string;
  unreadByAdmin: boolean;
  messages: SupportChatMessage[];
}

const LOCAL_SUPPORT_KEY = 'mks_live_support_threads_v1';

export const LiveSupportWidget: React.FC<{
  isOpenExternal?: boolean;
  onCloseExternal?: () => void;
  initialCategory?: 'general' | 'subscription' | 'password_reset' | 'bkst_gts';
  initialPrefill?: string;
}> = ({ isOpenExternal, onCloseExternal, initialCategory = 'general', initialPrefill = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'general' | 'subscription' | 'password_reset' | 'bkst_gts'>(
    initialCategory
  );
  const [messageText, setMessageText] = useState(initialPrefill);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [allThreads, setAllThreads] = useState<SupportThread[]>([]);
  const [selectedAdminThreadId, setSelectedAdminThreadId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const currentUser = auth.currentUser;
  const isAdmin = (currentUser?.email || '').toLowerCase() === 'nayiffirat@gmail.com';
  const effectiveOpen = isOpenExternal !== undefined ? isOpenExternal : isOpen;

  const handleClose = () => {
    setIsOpen(false);
    onCloseExternal?.();
  };

  useBackHandler(effectiveOpen, handleClose, 'live_support_modal', 90);
  useScrollLock(effectiveOpen);

  useEffect(() => {
    if (initialPrefill) setMessageText(initialPrefill);
    if (initialCategory) setActiveCategory(initialCategory);
  }, [initialPrefill, initialCategory]);

  const getThreadId = () => {
    if (currentUser?.uid) return `user_${currentUser.uid}`;
    let anonId = localStorage.getItem('mks_support_anon_id');
    if (!anonId) {
      anonId = `guest_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem('mks_support_anon_id', anonId);
    }
    return anonId;
  };

  useEffect(() => {
    if (!effectiveOpen) return;
    const threadId = getThreadId();

    // Load local fallback first
    try {
      const raw = localStorage.getItem(`${LOCAL_SUPPORT_KEY}_${threadId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setMessages(parsed);
      } else {
        setMessages([
          {
            id: 'welcome_1',
            sender: 'admin',
            senderName: 'Nayif Fırat (MKS Kurucu & Ziraat Mühendisi)',
            text: 'Merhaba! MKS Canlı Destek Hattına hoş geldiniz. Paket yükseltme (PRO / ULTRA / MAX), BKTS-GTS entegrasyonu, şifre kurtarma veya teknik sorularınız için buradan doğrudan bana yazabilirsiniz. Mesajınız anında ekranıma düşer.',
            timestamp: new Date().toISOString()
          }
        ]);
      }
    } catch {}

    // Subscribe to Firestore live support thread
    try {
      if (isAdmin) {
        const q = query(collection(db, 'MKS', 'g892bEaJyGfEq1Fa67yb', 'support_threads'));
        const unsub = onSnapshot(
          q,
          snap => {
            const list: SupportThread[] = [];
            snap.forEach(d => list.push(d.data() as SupportThread));
            list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
            setAllThreads(list);
            if (!selectedAdminThreadId && list.length > 0) {
              setSelectedAdminThreadId(list[0].threadId);
            }
          },
          () => {}
        );
        return () => unsub();
      } else {
        const docRef = doc(db, 'MKS', 'g892bEaJyGfEq1Fa67yb', 'support_threads', threadId);
        const unsub = onSnapshot(
          docRef,
          snap => {
            if (snap.exists()) {
              const data = snap.data() as SupportThread;
              if (Array.isArray(data.messages) && data.messages.length > 0) {
                setMessages(data.messages);
                localStorage.setItem(`${LOCAL_SUPPORT_KEY}_${threadId}`, JSON.stringify(data.messages));
              }
            }
          },
          () => {}
        );
        return () => unsub();
      }
    } catch {}
  }, [effectiveOpen, isAdmin, selectedAdminThreadId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedAdminThreadId, allThreads]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || sending) return;
    setSending(true);

    const text = messageText.trim();
    setMessageText('');

    const threadId = isAdmin && selectedAdminThreadId ? selectedAdminThreadId : getThreadId();
    const senderType: 'user' | 'admin' = isAdmin ? 'admin' : 'user';
    const senderName = isAdmin
      ? 'Nayif Fırat (MKS Yönetici)'
      : currentUser?.displayName || guestName || currentUser?.email || 'MKS Kullanıcısı';

    const newMsg: SupportChatMessage = {
      id: `msg_${Date.now()}`,
      sender: senderType,
      senderName,
      text,
      timestamp: new Date().toISOString(),
      category: activeCategory
    };

    const currentMsgs =
      isAdmin && selectedAdminThreadId
        ? allThreads.find(t => t.threadId === selectedAdminThreadId)?.messages || []
        : messages;

    const updatedMsgs = [...currentMsgs, newMsg];
    if (!isAdmin) {
      setMessages(updatedMsgs);
      localStorage.setItem(`${LOCAL_SUPPORT_KEY}_${threadId}`, JSON.stringify(updatedMsgs));
    }

    const threadPayload: SupportThread = {
      threadId,
      userUid: currentUser?.uid || threadId,
      userName: senderName,
      userEmail: currentUser?.email || '',
      userPhone: guestPhone || currentUser?.phoneNumber || '',
      userTier: getUserSubscriptionTier(undefined, isAdmin),
      updatedAt: new Date().toISOString(),
      unreadByAdmin: !isAdmin,
      messages: updatedMsgs
    };

    try {
      await setDoc(doc(db, 'MKS', 'g892bEaJyGfEq1Fa67yb', 'support_threads', threadId), threadPayload, {
        merge: true
      });
    } catch {}

    // Notify Fırat Bey directly on Telegram if sent by user
    if (!isAdmin) {
      const endpoints = Array.from(
        new Set([`${API_BASE}/api/support-message`, '/api/support-message'])
      );
      for (const ep of endpoints) {
        try {
          const res = await fetch(ep, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              senderName,
              email: currentUser?.email || 'Belirtilmedi',
              phone: guestPhone || currentUser?.phoneNumber || 'Belirtilmedi',
              category: activeCategory,
              tier: threadPayload.userTier,
              text
            })
          });
          if (res.ok) break;
        } catch {}
      }
    }

    setSending(false);
  };

  if (!effectiveOpen) {
    return null;
  }

  const activeAdminThread = allThreads.find(t => t.threadId === selectedAdminThreadId);
  const displayedMessages = isAdmin ? activeAdminThread?.messages || [] : messages;

  return (
    <div className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-stone-950 border border-emerald-500/25 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-950/90 via-stone-900 to-stone-950 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <MksBrandLogo size="lg" rounded="2xl" className="border-emerald-500/35" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping absolute -top-0.5 -right-0.5" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute -top-0.5 -right-0.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-white font-bold text-base">MKS Canlı Destek Hattı</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ÇEVRİMİÇİ
                </span>
              </div>
              <p className="text-stone-400 text-xs">
                Nayif Fırat (Kurucu & Ziraat Mühendisi) ile doğrudan anlık mesajlaşma
              </p>
            </div>
          </div>
          <button
            type="button"
            data-mks-modal-close="true"
            onClick={handleClose}
            aria-label="Kapat"
            className="p-2 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Category Pills or Admin Thread Selector */}
        {isAdmin ? (
          <div className="p-3 bg-stone-900/80 border-b border-white/5 flex gap-2 overflow-x-auto">
            {allThreads.length === 0 ? (
              <span className="text-xs text-stone-400 px-2 py-1">Henüz açık destek talebi yok.</span>
            ) : (
              allThreads.map(t => (
                <button
                  key={t.threadId}
                  type="button"
                  onClick={() => setSelectedAdminThreadId(t.threadId)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all ${
                    selectedAdminThreadId === t.threadId
                      ? 'bg-emerald-600 text-white border-emerald-400'
                      : 'bg-stone-800 text-stone-300 border-white/5 hover:bg-stone-700'
                  }`}
                >
                  {t.userName} ({t.userTier})
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="p-3 bg-stone-900/60 border-b border-white/5 space-y-2.5">
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {[
                { id: 'general', label: '💬 Genel Destek', icon: MessageCircle },
                { id: 'subscription', label: '👑 PRO / ULTRA / MAX Paket', icon: Crown },
                { id: 'bkst_gts', label: '🛡️ BKTS & GTS Kurulum', icon: ShieldCheck },
                { id: 'password_reset', label: '🔑 Şifre Kurtarma', icon: KeyRound }
              ].map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all ${
                    activeCategory === cat.id
                      ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm'
                      : 'bg-stone-900 text-stone-400 border-white/5 hover:text-stone-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            {!currentUser && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                  placeholder="Adınız Soyadınız / Bayi Adı"
                  className="bg-stone-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
                />
                <input
                  type="tel"
                  value={guestPhone}
                  onChange={e => setGuestPhone(e.target.value)}
                  placeholder="Telefon Numaranız (05XX...)"
                  className="bg-stone-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
                />
              </div>
            )}
          </div>
        )}

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-950/90 min-h-[260px]">
          {displayedMessages.map(msg => {
            const isMine = isAdmin ? msg.sender === 'admin' : msg.sender === 'user';
            return (
              <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-stone-500 mb-1 px-1">{msg.senderName}</span>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    isMine
                      ? 'bg-emerald-600 text-white rounded-br-sm shadow-lg shadow-emerald-950/50'
                      : 'bg-stone-900 text-stone-200 border border-white/10 rounded-bl-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                  <span
                    className={`text-[10px] mt-1 block text-right ${
                      isMine ? 'text-emerald-200' : 'text-stone-500'
                    }`}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString('tr-TR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Input & Direct WhatsApp Bar */}
        <div className="p-3.5 bg-stone-900 border-t border-white/10 space-y-2.5">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              placeholder="Mesajınızı buraya yazın (Anında Nayif Fırat'a iletilir)..."
              className="flex-1 bg-stone-950 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-stone-500 focus:border-emerald-500 outline-none"
            />
            <button
              type="submit"
              disabled={!messageText.trim() || sending}
              className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-stone-800 disabled:text-stone-500 text-white font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-emerald-950/50"
            >
              <Send size={17} />
              <span className="hidden sm:inline">Gönder</span>
            </button>
          </form>

          <div className="flex items-center justify-between pt-1 text-[11px] text-stone-400">
            <span>Mesajlarınız anında yönetici ekranına düşer.</span>
            <div className="flex items-center gap-3">
              <a
                href="https://wa.me/905428254087?text=Merhaba%20F%C4%B1rat%20Bey%2C%20MKS%20uygulamas%C4%B1%20i%C3%A7in%20destek%20almak%20istiyorum."
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
              >
                <Phone size={12} /> WhatsApp Hattı
              </a>
              <a
                href="mailto:nayiffirat@gmail.com"
                className="text-stone-300 hover:text-white flex items-center gap-1"
              >
                <Mail size={12} /> E-Posta
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Leaf, Image as ImageIcon, Sparkles, X } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { useAppViewModel } from '../context/AppContext';

export const AIAssistant: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string, imageUrl?: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || loading) return;

    const userMessage = input.trim();
    const currentImage = selectedImage;
    
    setMessages(prev => [...prev, { role: 'user', text: userMessage, imageUrl: currentImage || undefined }]);
    setInput('');
    setSelectedImage(null);
    setLoading(true);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("Gemini API anahtarı bulunamadı.");

      const ai = new GoogleGenAI({ apiKey });
      
      const parts: any[] = [];
      if (currentImage) {
        // Remove data:image/...;base64,
        const base64Data = currentImage.split(',')[1];
        const mimeType = currentImage.substring( currentImage.indexOf(":")+1, currentImage.indexOf(";") );
        parts.push({
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        });
      }
      
      if (userMessage) {
        parts.push({ text: userMessage });
      }

      if (messages.length === 0 && !userMessage) {
         parts.push({ text: "Merhaba, bana nasıl yardımcı olabilirsin?" });
      }

      // Convert history to string context approx for simplificity, or start fresh if first.
      // Usually we'd map `messages` to `ai.chats.create()`, but for simple bot:
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: { parts },
        config: {
          systemInstruction: "Sen uzman bir Ziraat Mühendisliği asistanısın. Çiftçilere hastalık teşhisi, ilaç kullanımı ve gübreleme tavsiyelerinde bulunuyorsun. Kısa, net, anlaşılır ve güven verici cevaplar üret.",
        }
      });
      
      const responseText = response.text || "Üzgünüm, bir yanıt oluşturamadım.";
      setMessages(prev => [...prev, { role: 'model', text: responseText }]);

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: "Bir hata oluştu. Lütfen tekrar deneyin." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] lg:h-[calc(100vh-40px)] bg-stone-950 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 mt-8 lg:mt-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 flex items-center justify-center">
              <Sparkles className="text-emerald-400" size={24} />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Gemini Zirai Danışman
            </h1>
            <p className="text-xs text-stone-400">Hastalık teşhis edin, bitki sağlığı sorun</p>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-stone-900/50 rounded-2xl border border-white/5 overflow-y-auto p-4 space-y-4 mb-4 backdrop-blur-sm">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-500/5 rounded-full flex items-center justify-center text-emerald-500/50">
               <Leaf size={32} />
            </div>
            <p className="text-stone-400 max-w-sm text-sm">
              Merhaba! Hastalıklı yaprak fotoğraflarını yükleyerek analiz yaptırabilir veya tarımsal sorularınızı sorabilirsiniz.
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}>
            <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-stone-800 text-stone-400' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className={`p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-stone-800 border border-white/5 text-stone-300 rounded-tl-none'}`}>
              {msg.imageUrl && (
                <img src={msg.imageUrl} alt="Uploaded" className="max-w-[200px] rounded-lg mb-2 border border-white/10" />
              )}
              <div className="whitespace-pre-wrap">{msg.text}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3 max-w-[85%] mr-auto">
             <div className="shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Bot size={16} />
            </div>
            <div className="p-4 rounded-2xl bg-stone-800 border border-white/5 rounded-tl-none flex items-center">
               <Loader2 size={16} className="animate-spin text-emerald-400" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="space-y-3">
        {selectedImage && (
          <div className="relative inline-block">
            <img src={selectedImage} alt="Preview" className="h-20 rounded-lg border border-emerald-500/30" />
            <button 
              onClick={() => setSelectedImage(null)}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
            >
              <X size={12} />
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileChange}
          />
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-3.5 bg-stone-800 text-stone-400 hover:text-emerald-400 rounded-xl border border-white/5 transition-colors shrink-0"
          >
            <ImageIcon size={20} />
          </button>
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Bir soru sorun veya belirti girin..."
            className="flex-1 bg-stone-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-stone-500 focus:outline-none focus:border-emerald-500/50"
          />
          <button 
            onClick={handleSend}
            disabled={(!input.trim() && !selectedImage) || loading}
            className="p-3.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-lg shadow-emerald-900/20"
          >
            <Send size={20} className={loading && !input ? "animate-pulse" : ""} />
          </button>
        </div>
      </div>
    </div>
  );
};

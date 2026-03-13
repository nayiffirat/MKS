
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, Type, FunctionDeclaration } from '@google/genai';
import { Mic, MicOff, X, Volume2, Sparkles, Loader2, Waves, Bot, AudioLines, Zap, Activity, CheckCircle2 } from 'lucide-react';
import { useAppViewModel } from '../context/AppContext';
import { dbService } from '../services/db';
import { Prescription } from '../types';

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// --- TOOL DEFINITIONS ---
const createReminderTool: FunctionDeclaration = {
    name: "createReminder",
    description: "Kullanıcı için yeni bir hatırlatıcı veya görev oluşturur.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            date: { type: Type.STRING },
            priority: { type: Type.STRING, enum: ["LOW", "MEDIUM", "HIGH"] },
            recurrence: { type: Type.STRING, enum: ["NONE", "DAILY", "WEEKLY", "MONTHLY"] }
        },
        required: ["title", "date"]
    }
};

const deleteReminderTool: FunctionDeclaration = {
    name: "deleteReminder",
    description: "Mevcut bir hatırlatıcıyı ID'sini kullanarak siler.",
    parameters: {
        type: Type.OBJECT,
        properties: { id: { type: Type.STRING } },
        required: ["id"]
    }
};

const updateReminderTool: FunctionDeclaration = {
    name: "updateReminder",
    description: "Mevcut bir hatırlatıcıyı günceller.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            date: { type: Type.STRING },
            priority: { type: Type.STRING, enum: ["LOW", "MEDIUM", "HIGH"] },
            recurrence: { type: Type.STRING, enum: ["NONE", "DAILY", "WEEKLY", "MONTHLY"] }
        },
        required: ["id"]
    }
};

const createPrescriptionTool: FunctionDeclaration = {
    name: "createPrescription",
    description: "Çiftçi için yeni bir reçete oluşturur.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            farmerName: { type: Type.STRING, description: "Çiftçinin tam adı" },
            pesticideName: { type: Type.STRING, description: "İlacın adı" },
            quantity: { type: Type.STRING, description: "Miktar (örn: 3 adet, 5 litre)" },
            unitPrice: { type: Type.NUMBER, description: "Birim fiyat" }
        },
        required: ["farmerName", "pesticideName", "quantity"]
    }
};

export const FieldAssistant: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { userProfile, farmers, reminders, addReminder, deleteReminder, editReminder, showToast, refreshStats } = useAppViewModel();
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [listeningTimeLeft, setListeningTimeLeft] = useState(0);
  const [isListening, setIsListening] = useState(false);
  
  const aiRef = useRef<any>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const listeningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptRef = useRef<string>('');

  const assistantVoiceName = userProfile.assistantVoice === 'MALE' ? 'Fenrir' : 'Zephyr';

  const stopAssistant = () => {
    try {
        if (listeningTimerRef.current) {
            clearInterval(listeningTimerRef.current);
            listeningTimerRef.current = null;
        }
        setListeningTimeLeft(0);
        setIsListening(false);

        if (sessionRef.current) {
            try { sessionRef.current.close(); } catch(e) {}
            sessionRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (inputContextRef.current) {
            inputContextRef.current.close();
            inputContextRef.current = null;
        }
        sourcesRef.current.forEach(s => s.stop());
        sourcesRef.current.clear();
    } catch (e) {
        console.error("Stop assistant error:", e);
    }
    setIsActive(false);
    setIsConnecting(false);
    setIsAiSpeaking(false);
  };

  const startAssistant = async () => {
    // Check for API Key
    if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
      await window.aistudio.openSelectKey();
    }

    setIsConnecting(true);
    setTranscription('');
    transcriptRef.current = '';
    
    try {
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("API anahtarı bulunamadı.");
      }
      const ai = new GoogleGenAI({ apiKey });
      aiRef.current = ai;

      const todayDate = new Date().toISOString().split('T')[0];
      const activeRemindersContext = reminders
        .filter(r => !r.isCompleted)
        .map(r => `ID: "${r.id}", Başlık: "${r.title}", Tarih: "${r.date}"`)
        .join('\n');

      // 1. Establish Connection FIRST
      const session = await ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { 
              voiceConfig: { 
                  prebuiltVoiceConfig: { voiceName: assistantVoiceName } 
              } 
          },
          tools: [{ functionDeclarations: [createReminderTool, deleteReminderTool, updateReminderTool, createPrescriptionTool] }],
          systemInstruction: `Sen 'MKS Saha Asistanı'sın. Bugün: ${todayDate}. ${farmers.length} çiftçi kayıtlı.
          Kullanıcının adı: ${userProfile.fullName}.
          MEVCUT GÖREVLER: ${activeRemindersContext || "Yok."}
          Hitap: 'Mühendisim'. Kısa ve net cevap ver.`,
        },
        callbacks: {
          onopen: () => {
            console.log("Connection opened");
            setIsListening(true);
          },
          onmessage: async (msg) => {
            if (msg.serverContent?.outputTranscription) {
              const newText = msg.serverContent.outputTranscription.text;
              transcriptRef.current += ' ' + newText;
              setTranscription(transcriptRef.current.slice(-150));
            }
            
            if (msg.toolCall?.functionCalls) {
                const functionResponses = [];
                for (const fc of msg.toolCall.functionCalls) {
                     try {
                         if (fc.name === 'createReminder') {
                             const { title, date, priority, recurrence } = fc.args as any;
                             await addReminder({
                                 title,
                                 description: 'Saha asistanı tarafından oluşturuldu.',
                                 date,
                                 priority: priority || 'MEDIUM',
                                 recurrence: recurrence || 'NONE',
                                 isCompleted: false
                             });
                             functionResponses.push({ id: fc.id, name: fc.name, response: { result: "Hatırlatıcı başarıyla oluşturuldu." } });
                         } else if (fc.name === 'deleteReminder') {
                             const { id } = fc.args as any;
                             await deleteReminder(id);
                             functionResponses.push({ id: fc.id, name: fc.name, response: { result: "Hatırlatıcı silindi." } });
                         } else if (fc.name === 'updateReminder') {
                             const { id, title, date, priority, recurrence } = fc.args as any;
                             await editReminder(id, {
                                 title,
                                 date,
                                 priority: priority || 'MEDIUM',
                                 recurrence: recurrence || 'NONE'
                             });
                             functionResponses.push({ id: fc.id, name: fc.name, response: { result: "Hatırlatıcı güncellendi." } });
                         } else if (fc.name === 'createPrescription') {
                             const { farmerName, pesticideName, quantity, unitPrice } = fc.args as any;
                             
                             // 1. Find Farmer
                             const farmer = farmers.find(f => 
                                f.fullName.toLowerCase().includes(farmerName.toLowerCase())
                             );
                             
                             if (!farmer) {
                                 functionResponses.push({ id: fc.id, name: fc.name, response: { error: "Çiftçi bulunamadı." } });
                                 continue;
                             }

                             // 2. Find Pesticide (Optional, but good for ID)
                             const allPesticides = await dbService.getPesticides();
                             const pesticide = allPesticides.find(p => 
                                p.name.toLowerCase().includes(pesticideName.toLowerCase())
                             );

                             const pId = pesticide ? pesticide.id : crypto.randomUUID();
                             const pName = pesticide ? pesticide.name : pesticideName;
                             const pDosage = pesticide ? pesticide.defaultDosage : 'Saha asistanı ile eklendi';

                             // 3. Create Prescription
                             const newPrescription: Prescription = {
                                 id: `REC-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`,
                                 farmerId: farmer.id,
                                 date: new Date().toISOString(),
                                 prescriptionNo: `VOICE-${Date.now()}`,
                                 engineerName: userProfile.fullName,
                                 items: [{
                                     pesticideId: pId,
                                     pesticideName: pName,
                                     dosage: pDosage,
                                     quantity: quantity,
                                     unitPrice: unitPrice,
                                     totalPrice: unitPrice ? (parseFloat(quantity) * unitPrice) : 0
                                 }],
                                 isOfficial: false,
                                 totalAmount: unitPrice ? (parseFloat(quantity) * unitPrice) : 0
                             };

                             await dbService.addPrescription(newPrescription);
                             await refreshStats();
                             functionResponses.push({ id: fc.id, name: fc.name, response: { result: `${farmer.fullName} için reçete başarıyla oluşturuldu.` } });
                         }
                     } catch (e) {
                         functionResponses.push({ id: fc.id, name: fc.name, response: { error: "İşlem başarısız oldu." } });
                     }
                }
                
                if (functionResponses.length > 0 && sessionRef.current) {
                    sessionRef.current.sendToolResponse({ functionResponses });
                }
            }

            if (msg.serverContent?.outputTranscription) {
              // Handled above
            }
            
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && audioContextRef.current) {
              setIsAiSpeaking(true);
              setIsListening(false); // Stop listening while AI is speaking
              const ctx = audioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => {
                  sourcesRef.current.delete(source);
                  if (sourcesRef.current.size === 0) {
                      setIsAiSpeaking(false);
                      setIsListening(true); // Resume listening after AI finishes
                  }
              };
            }
          },
          onerror: (e) => {
              console.error("Gemini Live API Error:", e);
              setIsConnecting(false);
          },
          onclose: () => stopAssistant()
        }
      });

      // 2. Assign session to ref
      sessionRef.current = session;
      setIsConnecting(false);
      setIsActive(true);
      
      // Start 10 second countdown for initial listening
      setListeningTimeLeft(10);
      listeningTimerRef.current = setInterval(() => {
          setListeningTimeLeft(prev => {
              if (prev <= 1) {
                  if (listeningTimerRef.current) clearInterval(listeningTimerRef.current);
                  return 0;
              }
              return prev - 1;
          });
      }, 1000);

      // 3. Start Audio Input AFTER session is established
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      inputContextRef.current = inputCtx;
      
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
        const blob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
        
        // Use the ref to send input
        if (sessionRef.current) {
            sessionRef.current.sendRealtimeInput({ media: blob });
        }
      };
      
      source.connect(processor);
      processor.connect(inputCtx.destination);

    } catch (err) {
      console.error(err);
      setIsConnecting(false);
      const errorMsg = err instanceof Error ? err.message : "Bağlantı hatası oluştu.";
      showToast(errorMsg, 'error');
      stopAssistant();
    }
  };

  useEffect(() => {
    return () => stopAssistant();
  }, []);

  return (
    <div className="h-screen flex flex-col bg-stone-950 animate-in fade-in duration-700 relative overflow-hidden">
      {/* Visual elements */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
          {isActive && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-emerald-500/10 blur-[150px] rounded-full animate-pulse"></div>
          )}
      </div>

      <header className="relative z-10 flex items-center justify-between p-5 pt-6 shrink-0">
        <button onClick={onBack} className="p-3 bg-stone-900/60 backdrop-blur-xl rounded-2xl text-stone-400 hover:text-white border border-white/10 active:scale-90 transition-all shadow-lg">
            <X size={20} />
        </button>
        <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 mb-0.5">
                <Activity size={10} className={isActive ? "text-emerald-500 animate-pulse" : "text-stone-700"} />
                <h2 className="text-stone-100 font-black uppercase tracking-[0.25em] text-[10px]">MKS SAHA MODU</h2>
            </div>
            <span className="text-[8px] text-stone-500 font-bold uppercase tracking-widest">{isActive ? 'Şifreli Canlı Bağlantı' : 'Bekleme Modu'}</span>
        </div>
        <div className="w-11"></div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-8 relative z-10 space-y-8 pb-10">
        
        {/* Visualizer - Moved slightly up via margin adjustment context */}
        <div className="relative">
            {isActive && (
                <div className={`absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full transition-all duration-1000 ${isAiSpeaking ? 'scale-150 opacity-40' : 'scale-100 opacity-20'}`}></div>
            )}
            <div className={`w-32 h-32 rounded-[2.5rem] flex items-center justify-center mx-auto transition-all duration-700 relative z-10 ${isActive ? (isAiSpeaking ? 'bg-emerald-500 shadow-[0_0_60px_rgba(16,185,129,0.4)] rotate-45 scale-110' : 'bg-stone-900 border-2 border-emerald-500/30 scale-100') : 'bg-stone-900/50 border border-white/5 opacity-50'}`}>
                {isActive ? (
                    isAiSpeaking ? <AudioLines size={48} className="text-white animate-bounce" /> : <Waves size={48} className="text-emerald-400 animate-pulse" />
                ) : (
                    <Bot size={48} className="text-stone-700" />
                )}
            </div>
        </div>
        
        {/* Status Text - Centered */}
        <div className="text-center max-w-xs mx-auto space-y-2">
            <h3 className="text-xl font-bold text-stone-100 tracking-tight">
                {isConnecting ? "Güçlendiriliyor..." : isActive ? (isAiSpeaking ? "Asistan Cevaplıyor" : (listeningTimeLeft > 0 ? `Dinliyorum (${listeningTimeLeft}s)` : "Sizi Dinliyorum")) : "Saha Asistanı"}
            </h3>
            <p className="text-stone-500 text-xs font-medium leading-relaxed opacity-80 h-8 line-clamp-2">
                {isActive ? transcription || (listeningTimeLeft > 0 ? "Asistan sizi 10 saniye boyunca kesintisiz dinleyecek..." : "Konuşmaya devam edebilirsiniz...") : `${assistantVoiceName} sesi ile akıllı asistanı başlatın.`}
            </p>
        </div>

        {/* Button - Moved Up */}
        <div className="relative pt-2">
              {isActive && (
                   <div className="absolute inset-0 top-2 bg-rose-500/20 blur-2xl rounded-full animate-ping"></div>
              )}
              <button 
                onClick={isActive ? stopAssistant : startAssistant}
                disabled={isConnecting}
                className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-90 group relative z-10 border-4 ${
                    isActive 
                    ? 'bg-rose-600 border-rose-500/30 shadow-rose-900/40 rotate-90' 
                    : 'bg-emerald-600 border-emerald-500/30 shadow-emerald-900/40 hover:bg-emerald-500'
                }`}
              >
                {isConnecting ? (
                    <Loader2 className="animate-spin text-white" size={32} />
                ) : isActive ? (
                    <MicOff className="text-white -rotate-90" size={32} />
                ) : (
                    <Mic className="text-white group-hover:scale-110 transition-transform" size={32} />
                )}
              </button>
        </div>

      </div>
    </div>
  );
};

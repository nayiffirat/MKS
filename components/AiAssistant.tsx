
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality, ThinkingLevel } from "@google/genai";
import { useAppViewModel } from '../context/AppContext';
import { Mic, Loader2, ChevronLeft, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AiAssistantProps {
    onBack?: () => void;
}

export const AiAssistant: React.FC<AiAssistantProps> = ({ onBack }) => {
    const { showToast, hapticFeedback, userProfile } = useAppViewModel();
    
    const [isLoading, setIsLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const recognitionRef = useRef<any>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const isFemale = userProfile.assistantVoice === 'female';
    const assistantImage = isFemale 
        ? "https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&q=80&w=800" // Female agronomist
        : "https://images.unsplash.com/photo-1592982537447-6f2a6a0a3023?auto=format&fit=crop&q=80&w=800"; // Male agronomist

    useEffect(() => {
        // Initialize Speech Recognition
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'tr-TR';

            recognitionRef.current.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setIsListening(false);
                handleSend(transcript);
            };

            recognitionRef.current.onerror = (event: any) => {
                console.error("Speech recognition error:", event.error);
                setIsListening(false);
                if (event.error !== 'no-speech') {
                    showToast('Ses tanıma hatası: ' + event.error, 'error');
                }
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
            };
        }

        // Cleanup speech synthesis on unmount
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            stopSpeaking();
        };
    }, []);

    // Initial greeting removed per user request


    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
        } else {
            try {
                stopSpeaking();
                recognitionRef.current?.start();
                setIsListening(true);
                hapticFeedback('light');
            } catch (error) {
                console.error("Failed to start listening:", error);
                showToast('Mikrofon başlatılamadı', 'error');
            }
        }
    };

    const stopSpeaking = () => {
        if (audioRef.current) {
            try {
                audioRef.current.pause();
            } catch (e) {
                console.error("Error stopping audio:", e);
            }
            audioRef.current = null;
        }
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        setIsSpeaking(false);
    };

    const fallbackTTS = (text: string) => {
        if (!window.speechSynthesis) {
            setIsSpeaking(false);
            return;
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'tr-TR';
        utterance.rate = 1.05;
        
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        window.speechSynthesis.speak(utterance);
    };

    const speakText = async (text: string) => {
        stopSpeaking();
        setIsSpeaking(true);
        
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
            const voiceName = isFemale ? 'Kore' : 'Fenrir';
            
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName },
                        },
                    },
                },
            });

            const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
            if (inlineData?.data) {
                const binaryString = window.atob(inlineData.data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }

                const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const pcm16 = new Int16Array(bytes.buffer);
                const float32 = new Float32Array(pcm16.length);
                for (let i = 0; i < pcm16.length; i++) {
                    float32[i] = pcm16[i] / 32768.0;
                }

                const audioBuffer = audioCtx.createBuffer(1, float32.length, 24000);
                audioBuffer.getChannelData(0).set(float32);

                const source = audioCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioCtx.destination);
                
                source.onended = () => {
                    setIsSpeaking(false);
                    audioCtx.close();
                };
                
                source.start();
                
                (audioRef as any).current = {
                    pause: () => {
                        source.stop();
                        audioCtx.close();
                    },
                    currentTime: 0
                };

            } else {
                fallbackTTS(text);
            }
        } catch (error) {
            console.error("Gemini TTS Error:", error);
            fallbackTTS(text);
        }
    };

    const handleSend = async (userMessage: string) => {
        if (!userMessage.trim() || isLoading) return;

        setIsLoading(true);
        hapticFeedback('light');
        stopSpeaking();

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
            // Using gemini-3-flash-preview for faster response times
            const modelName = "gemini-3-flash-preview"; 
            
            const response = await ai.models.generateContent({
                model: modelName,
                contents: [
                    { role: 'user', parts: [{ text: userMessage }] }
                ],
                config: {
                    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                    systemInstruction: `Sen uzman bir ziraat mühendisi ve tarım danışmanısın. 
                    Görevin SADECE tarımsal soruları (bitki hastalıkları, zararlılar, gübreleme, sulama, budama vb.) cevaplamaktır.
                    Reçete yazma, ziyaret oluşturma, ödeme alma gibi sistem içi işlemleri YAPAMAZSIN. Eğer kullanıcı bunları isterse, "Ben sadece tarımsal konularda bilgi verebilirim, sistem işlemlerini ana menüden yapabilirsiniz" de.
                    Cevaplarını sesli okunacağı için çok uzun tutma, kısa, net, anlaşılır ve sohbet havasında ver. Madde işaretleri yerine düz cümleler kurmayı tercih et çünkü sesli okunacak.
                    ${isFemale 
                        ? 'Kişiliğin: Çok sakin, kadınsı, kibar, anlayışlı ve güven veren bir tarzda konuş.' 
                        : 'Kişiliğin: Tok sesli, insansı, etkileyici, kendinden emin ve profesyonel bir tarzda konuş.'}
                    Mühendis ismi: ${userProfile?.fullName || 'Bilinmiyor'}.`
                }
            });

            const reply = response.text || 'Anlayamadım, lütfen tekrar eder misiniz?';
            speakText(reply);

        } catch (error) {
            console.error("AI Assistant Error:", error);
            const errorMsg = 'Bağlantı hatası oluştu. Lütfen tekrar deneyin.';
            speakText(errorMsg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-stone-950 flex flex-col items-center justify-center animate-in slide-in-from-bottom duration-300 relative overflow-hidden">
            {/* Header */}
            <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-20 pt-12">
                <button 
                    onClick={() => {
                        stopSpeaking();
                        onBack?.();
                    }}
                    className="p-3 bg-stone-900/80 rounded-full text-white backdrop-blur-md hover:bg-stone-800 transition-colors"
                >
                    <ChevronLeft size={24} />
                </button>
                {isSpeaking && (
                    <button 
                        onClick={stopSpeaking} 
                        className="px-4 py-2 bg-stone-900/80 rounded-full text-white backdrop-blur-md flex items-center gap-2 hover:bg-stone-800 transition-colors"
                    >
                        <Square size={14} className="fill-current" /> 
                        <span className="text-xs font-bold uppercase tracking-wider">Durdur</span>
                    </button>
                )}
            </div>

            {/* Background Glow */}
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120vw] h-[120vw] rounded-full blur-[100px] opacity-20 pointer-events-none transition-colors duration-1000 ${
                isListening ? 'bg-red-500' : isSpeaking ? 'bg-emerald-500' : 'bg-stone-800'
            }`}></div>

            {/* Center Image */}
            <div className="relative w-64 h-64 md:w-80 md:h-80 rounded-full overflow-hidden border-4 border-stone-800 shadow-2xl mb-16 z-10">
                <img 
                    src={assistantImage} 
                    alt="Assistant" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                />
                
                {/* Overlay for speaking/listening state */}
                <AnimatePresence>
                    {(isListening || isSpeaking || isLoading) && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm"
                        >
                            {isLoading ? (
                                <Loader2 size={48} className="text-emerald-500 animate-spin" />
                            ) : (
                                <div className="flex items-center gap-2 h-16">
                                    {[...Array(5)].map((_, i) => (
                                        <motion.div
                                            key={i}
                                            animate={{ 
                                                height: isSpeaking ? ['20%', '100%', '40%', '80%', '20%'] : ['20%', '60%', '20%'],
                                            }}
                                            transition={{ 
                                                repeat: Infinity, 
                                                duration: isSpeaking ? 1.2 : 1.5,
                                                delay: i * 0.1,
                                                ease: "easeInOut"
                                            }}
                                            className={`w-2 rounded-full ${isListening ? 'bg-red-500' : 'bg-emerald-500'}`}
                                            style={{ height: '20%' }}
                                        />
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Mic Button */}
            <div className="relative z-10">
                {isListening && (
                    <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-40 scale-150"></div>
                )}
                <button 
                    onClick={toggleListening}
                    disabled={isLoading}
                    className={`relative w-24 h-24 flex items-center justify-center rounded-full shadow-2xl transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 ${
                        isListening 
                        ? 'bg-red-500 text-white shadow-[0_0_40px_rgba(239,68,68,0.6)]' 
                        : 'bg-emerald-600 text-white shadow-[0_0_40px_rgba(5,150,105,0.4)] hover:bg-emerald-500'
                    }`}
                >
                    <Mic size={40} className={isListening ? 'animate-pulse' : ''} />
                </button>
            </div>
            
            <p className="mt-8 text-stone-500 text-sm font-bold uppercase tracking-widest z-10">
                {isListening ? 'Sizi Dinliyorum...' : isLoading ? 'Düşünüyor...' : isSpeaking ? 'Konuşuyor...' : 'Konuşmak İçin Dokunun'}
            </p>
        </div>
    );
};
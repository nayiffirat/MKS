import React, { useState, useRef, useEffect } from 'react';
import { Camera, Mic, Save, X } from 'lucide-react';
import { dbService } from '../services/db';
import { GeminiService } from '../services/gemini';
import { Farmer } from '../types';

interface VisitLogFormProps {
    onBack: () => void;
}

export const VisitLogForm: React.FC<VisitLogFormProps> = ({ onBack }) => {
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [selectedFarmerId, setSelectedFarmerId] = useState('');
    const [note, setNote] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    
    // Camera Logic
    const videoRef = useRef<HTMLVideoElement>(null);
    const [photo, setPhoto] = useState<string | null>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    useEffect(() => {
        dbService.getFarmers().then(setFarmers);
    }, []);

    const startCamera = async () => {
        setIsCameraOpen(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (err) {
            console.error("Camera error", err);
            alert("Kamera erişimi sağlanamadı.");
            setIsCameraOpen(false);
        }
    };

    const capturePhoto = async () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setPhoto(dataUrl);
        
        // Stop stream
        const stream = videoRef.current.srcObject as MediaStream;
        stream?.getTracks().forEach(t => t.stop());
        setIsCameraOpen(false);

        // Analyze with Gemini
        setIsAnalyzing(true);
        const result = await GeminiService.analyzePlantImage(dataUrl);
        setAnalysis(result);
        setNote(prev => prev + (prev ? '\n\n' : '') + `[Yapay Zeka Analizi]: ${result}`);
        setIsAnalyzing(false);
    };

    const handleSave = async () => {
        if (!selectedFarmerId) return;
        await dbService.addVisit({
            id: crypto.randomUUID(),
            farmerId: selectedFarmerId,
            date: new Date().toISOString(),
            note,
            photoUri: photo || undefined,
            aiAnalysis: analysis || undefined
        });
        onBack();
    };

    // Toggle Mic (Mock)
    const toggleMic = () => {
        setIsRecording(!isRecording);
        if (!isRecording) {
            setTimeout(() => {
                setNote(prev => prev + " (Sesli not örneği: Tarlada yoğun yaprak biti gözlendi.)");
                setIsRecording(false);
            }, 2000);
        }
    };

    return (
        <div className="p-4 max-w-2xl mx-auto pb-24">
            <div className="flex items-center justify-between mb-6">
                <button onClick={onBack} className="text-stone-500 font-medium">İptal</button>
                <h2 className="text-xl font-bold">Yeni Ziyaret Kaydı</h2>
                <div className="w-10"></div>
            </div>

            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-stone-600 mb-2">Çiftçi Seçimi</label>
                    <select 
                        className="w-full p-4 rounded-xl bg-white border border-stone-200 outline-none focus:ring-2 focus:ring-agri-500"
                        value={selectedFarmerId}
                        onChange={e => setSelectedFarmerId(e.target.value)}
                    >
                        <option value="">Seçiniz...</option>
                        {farmers.map(f => (
                            <option key={f.id} value={f.id}>{f.fullName} - {f.village}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-stone-600 mb-2">Fotoğraf & Analiz</label>
                    {!photo ? (
                         isCameraOpen ? (
                             <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                                 <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
                                 <button onClick={capturePhoto} className="absolute bottom-4 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full border-4 border-stone-300"></button>
                             </div>
                         ) : (
                             <button onClick={startCamera} className="w-full py-8 border-2 border-dashed border-stone-300 rounded-xl flex flex-col items-center justify-center text-stone-500 hover:bg-stone-50">
                                 <Camera size={32} className="mb-2"/>
                                 <span>Fotoğraf Çek ve Analiz Et</span>
                             </button>
                         )
                    ) : (
                        <div className="relative">
                            <img src={photo} alt="Capture" className="w-full rounded-xl" />
                            <button onClick={() => setPhoto(null)} className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full"><X size={16}/></button>
                            {isAnalyzing && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white font-bold">
                                    Yapay Zeka Analiz Ediyor...
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-stone-600 mb-2">Notlar</label>
                    <div className="relative">
                        <textarea 
                            className="w-full p-4 rounded-xl bg-white border border-stone-200 h-40 outline-none focus:ring-2 focus:ring-agri-500"
                            placeholder="Gözlemlerinizi buraya yazın..."
                            value={note}
                            onChange={e => setNote(e.target.value)}
                        ></textarea>
                        <button 
                            onClick={toggleMic}
                            className={`absolute bottom-4 right-4 p-3 rounded-full shadow-md transition-colors ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-agri-100 text-agri-600'}`}
                        >
                            <Mic size={20} />
                        </button>
                    </div>
                </div>

                <button 
                    onClick={handleSave}
                    disabled={!selectedFarmerId}
                    className="w-full bg-agri-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-agri-700 disabled:opacity-50 flex items-center justify-center"
                >
                    <Save className="mr-2" /> Kaydı Tamamla
                </button>
            </div>
        </div>
    );
};
import React, { useState, useEffect, useRef } from 'react';
import { useAppViewModel } from '../context/AppContext';
import { Message } from '../types';
import { Send, ChevronLeft, User as UserIcon } from 'lucide-react';

export const MessagesScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { messages, sendMessage, activeTeamMember, userProfile } = useAppViewModel();
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        if (!activeTeamMember && userProfile.role !== 'admin') return;
        
        await sendMessage(newMessage.trim());
        setNewMessage('');
    };

    const currentUserId = activeTeamMember?.id || 'admin-bypass';

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] max-w-4xl mx-auto bg-stone-950">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-stone-800 bg-stone-900/50 backdrop-blur-xl sticky top-0 z-10">
                <button onClick={onBack} className="p-2 bg-stone-800 rounded-xl text-stone-400 hover:text-white transition-colors">
                    <ChevronLeft size={20} />
                </button>
                <div>
                    <h1 className="text-lg font-bold text-white">Firma İçi Mesajlaşma</h1>
                    <p className="text-stone-400 text-xs">{userProfile.companyName}</p>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, index) => {
                    const isMe = msg.senderId === currentUserId;
                    const showHeader = index === 0 || messages[index - 1].senderId !== msg.senderId;

                    return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            {showHeader && (
                                <span className="text-[10px] text-stone-500 mb-1 ml-1 mr-1">
                                    {isMe ? 'Sen' : msg.senderName}
                                </span>
                            )}
                            <div 
                                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                                    isMe 
                                        ? 'bg-emerald-600 text-white rounded-tr-sm' 
                                        : 'bg-stone-800 text-stone-200 rounded-tl-sm'
                                }`}
                            >
                                <p className="text-sm break-words">{msg.text}</p>
                                <span className={`text-[9px] mt-1 block ${isMe ? 'text-emerald-200' : 'text-stone-500'}`}>
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-stone-800 bg-stone-900/50 backdrop-blur-xl">
                <form onSubmit={handleSend} className="flex gap-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        placeholder="Mesajınızı yazın..."
                        className="flex-1 bg-stone-950 border border-stone-800 rounded-2xl px-4 py-3 text-white text-sm focus:border-emerald-500 outline-none transition-colors"
                    />
                    <button 
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="p-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-stone-800 disabled:text-stone-500 text-white rounded-2xl transition-colors flex items-center justify-center"
                    >
                        <Send size={20} />
                    </button>
                </form>
            </div>
        </div>
    );
};

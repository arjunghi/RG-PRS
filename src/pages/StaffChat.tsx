import React, { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, limit } from "firebase/firestore";
import { db } from "../lib/firebaseClient";
import { useAuth } from "../lib/AuthContext";
import { Send, Users } from "lucide-react";

export default function StaffChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const getFormattedTime = (createdAt: any) => {
    if (!createdAt) return "Sending...";
    try {
      if (typeof createdAt.toMillis === "function") {
        return new Date(createdAt.toMillis()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      if (typeof createdAt.toDate === "function") {
        return createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      if (createdAt.seconds) {
        return new Date(createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      const parsed = new Date(createdAt);
      if (!isNaN(parsed.getTime())) {
        return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    } catch (err) {
      console.warn("Time format error:", err);
    }
    return "Sending...";
  };

  useEffect(() => {
    const q = query(
      collection(db, "staff_chat"),
      orderBy("createdAt", "desc"),
      limit(100)
    );
    const unsub = onSnapshot(q, (snap) => {
       const msgs = snap.docs.map(d => ({ 
         id: d.id, 
         ...d.data({ serverTimestamps: 'estimate' }) 
       })).reverse();
       setMessages(msgs);
       setTimeout(() => {
          endRef.current?.scrollIntoView({ behavior: 'smooth' });
       }, 100);
    });
    return unsub;
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;
    
    const msg = newMessage.trim();
    setNewMessage("");

    await addDoc(collection(db, "staff_chat"), {
       text: msg,
       senderName: user.displayName || user.email,
       senderEmail: user.email,
       senderPhoto: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email || "U")}`,
       createdAt: serverTimestamp()
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] -mt-4 -mx-4 md:-mx-8">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white/50 backdrop-blur-sm sticky top-0 z-10 shrink-0">
        <div>
           <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center">
             <Users className="w-5 h-5 mr-3 text-indigo-500" />
             Staff Room Announcements
           </h2>
           <p className="text-sm text-slate-500 font-medium">Discuss with all active staff members</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
        {messages.map((m, i) => {
          const isMe = m.senderEmail === user?.email;
          const time = getFormattedTime(m.createdAt);
          return (
            <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
               <div className={`flex max-w-[75%] ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                  <img src={m.senderPhoto} alt="avatar" className={`w-10 h-10 rounded-full shrink-0 ${isMe ? "ml-4" : "mr-4"} border border-slate-200 mt-1`} />
                  <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                     <div className="flex items-center space-x-2 mb-1">
                        {!isMe && <span className="font-bold text-xs text-slate-700">{m.senderName}</span>}
                        <span className="text-[10px] text-slate-400 font-bold uppercase">{time}</span>
                     </div>
                     <div className={`px-5 py-3 rounded-2xl text-[15px] leading-relaxed relative
                        ${isMe ? "bg-slate-900 text-white rounded-tr-sm" : "bg-white border border-slate-100 text-slate-800 shadow-sm shadow-slate-200/20 rounded-tl-sm"}`}>
                        {m.text}
                     </div>
                  </div>
               </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-slate-100 shrink-0">
         <form onSubmit={handleSend} className="relative max-w-4xl mx-auto flex items-end bg-slate-50 rounded-3xl p-1.5 border border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
           <textarea 
             autoFocus
             value={newMessage}
             onChange={e => setNewMessage(e.target.value)}
             placeholder="Message everyone..."
             className="flex-1 max-h-32 min-h-[44px] bg-transparent outline-none resize-none px-4 py-3 pb-8 md:pb-3 w-full text-sm font-medium placeholder-slate-400 custom-scrollbar"
             onKeyDown={(e) => {
               if (e.key === 'Enter' && !e.shiftKey) {
                 e.preventDefault();
                 handleSend(e);
               }
             }}
           />
           <button type="submit" disabled={!newMessage.trim()} 
              className="absolute right-3 bottom-2.5 h-10 w-10 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white rounded-full flex items-center justify-center transition-all shrink-0 shadow-md shadow-indigo-600/20">
              <Send className="w-4 h-4 ml-0.5" />
           </button>
         </form>
      </div>
    </div>
  )
}

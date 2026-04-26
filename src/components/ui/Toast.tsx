import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Bell, Info, AlertCircle, CheckCircle } from 'lucide-react';

export type ToastType = 'info' | 'success' | 'warning' | 'error' | 'status';

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: ToastType;
}

interface ToastProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastProps) {
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            className="pointer-events-auto"
          >
            <div className={`
              glass-card min-w-[320px] p-4 flex items-start gap-4 border border-white/10
              ${toast.type === 'status' ? 'bg-blue-500/10' : ''}
              ${toast.type === 'success' ? 'bg-emerald-500/10' : ''}
              ${toast.type === 'error' ? 'bg-red-500/10' : ''}
             shadow-2xl backdrop-blur-xl
            `}>
              <div className={`p-2 rounded-lg 
                ${toast.type === 'status' ? 'bg-blue-500/20 text-blue-400' : ''}
                ${toast.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : ''}
                ${toast.type === 'error' ? 'bg-red-500/20 text-red-400' : ''}
                ${toast.type === 'info' ? 'bg-purple-500/20 text-purple-400' : ''}
              `}>
                {toast.type === 'status' && <User size={18} />}
                {toast.type === 'success' && <CheckCircle size={18} />}
                {toast.type === 'error' && <AlertCircle size={18} />}
                {toast.type === 'info' && <Bell size={18} />}
              </div>
              
              <div className="flex-1">
                <div className="text-sm font-bold text-white mb-0.5">{toast.title}</div>
                <div className="text-xs text-slate-400 leading-relaxed">{toast.message}</div>
              </div>
              
              <button 
                onClick={() => onClose(toast.id)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <AlertCircle size={14} className="rotate-45" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

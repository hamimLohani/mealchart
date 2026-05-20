"use client";

import { useEffect } from "react";
import { useUiStore, Toast as ToastType } from "@/store/ui-store";
import { motion, AnimatePresence } from "framer-motion";

export function ToastContainer() {
  const toasts = useUiStore((state) => state.toasts);

  return (
    <div className="fixed bottom-6 left-1/2 z-[100] flex w-full max-w-xs -translate-x-1/2 flex-col gap-3 px-4 sm:bottom-8 sm:left-auto sm:right-8 sm:translate-x-0">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast }: { toast: ToastType }) {
  const removeToast = useUiStore((state) => state.removeToast);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      removeToast(toast.id);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [toast.id, removeToast]);

  const variants = {
    initial: { opacity: 0, y: 20, scale: 0.9, x: 0 },
    animate: { opacity: 1, y: 0, scale: 1, x: 0 },
    exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } },
  };

  const bgClass =
    toast.type === "success"
      ? "bg-[color:var(--accent)] text-white shadow-[0_8px_20px_var(--accent-glow)]"
      : toast.type === "error"
      ? "bg-[color:var(--danger)] text-white shadow-[0_8px_20px_rgba(239,68,68,0.3)]"
      : "bg-[color:var(--foreground)] text-white shadow-lg";

  return (
    <motion.div
      layout
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={`flex items-center gap-3 rounded-[var(--radius-sm)] px-4 py-3.5 text-sm font-semibold ${bgClass} pointer-events-auto`}
    >
      <ToastIcon type={toast.type} />
      <p className="flex-1 leading-snug">{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        className="ml-1 rounded-full p-1 transition-colors hover:bg-white/20"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </motion.div>
  );
}

function ToastIcon({ type }: { type: ToastType["type"] }) {
  if (type === "success") {
    return (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
    );
  }
  if (type === "error") {
    return (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.34c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
    );
  }

  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
    </svg>
  );
}

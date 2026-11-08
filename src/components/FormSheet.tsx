"use client";

import { useEffect } from "react";

type Props = {
  open: boolean;
  title: string;
  kicker?: string;
  onClose: () => void;
  children: React.ReactNode;
};

/** Bottom/center sheet for create forms — keeps list pages readable on mobile. */
export function FormSheet({
  open,
  title,
  kicker = "Nuevo",
  onClose,
  children,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="form-sheet-root" role="dialog" aria-modal="true" aria-label={title}>
      <div className="form-sheet-backdrop" onClick={onClose} aria-hidden />
      <div className="form-sheet">
        <div className="form-sheet-handle" aria-hidden />
        <div className="form-sheet-head">
          <div>
            <p className="form-sheet-kicker">{kicker}</p>
            <h2>{title}</h2>
          </div>
          <button type="button" className="btn ghost" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <div className="form-sheet-body">{children}</div>
      </div>
    </div>
  );
}

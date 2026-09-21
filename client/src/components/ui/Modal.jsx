import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export function Modal({ title, subtitle, children, onClose, wide = false }) {
  useEffect(() => {
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const listener = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', listener);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener('keydown', listener);
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className={`modal ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="close" aria-label="Close dialog" onClick={onClose}>
          <X />
        </button>
        <div className="eyebrow">COLDLINE WORKSPACE</div>
        <h2>{title}</h2>
        <p className="muted">{subtitle}</p>
        {children}
      </section>
    </div>
  );
}

import React from 'react';
import { X } from 'lucide-react';

export function Modal({ title, subtitle, wide, onClose, children }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal-card ${wide ? 'wide' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="Close modal"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

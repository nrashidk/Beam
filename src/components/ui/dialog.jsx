import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export function Dialog({ open, onOpenChange, children }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={() => onOpenChange(false)}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" />
      
      {/* Dialog Container */}
      <div
        className="relative z-50 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogContent({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-lg shadow-xl p-6 w-full ${className}`}>
      {children}
    </div>
  );
}

export function DialogHeader({ children }) {
  return (
    <div className="mb-4 pb-4 border-b border-gray-200">
      {children}
    </div>
  );
}

export function DialogTitle({ children }) {
  return (
    <h2 className="text-xl font-bold text-gray-900">
      {children}
    </h2>
  );
}

export function DialogFooter({ children }) {
  return (
    <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end gap-2">
      {children}
    </div>
  );
}

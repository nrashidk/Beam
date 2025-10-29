import { CheckCircle, X } from 'lucide-react';
import { useEffect } from 'react';

export default function Toast({ message, onClose, type = 'success' }) {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-slideUp">
        <div className={`p-6 ${type === 'success' ? 'bg-gradient-to-br from-green-50 to-emerald-50' : 'bg-gradient-to-br from-red-50 to-rose-50'}`}>
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 p-2 rounded-full ${type === 'success' ? 'bg-green-100' : 'bg-red-100'}`}>
              {type === 'success' ? (
                <CheckCircle className="w-8 h-8 text-green-600" />
              ) : (
                <X className="w-8 h-8 text-red-600" />
              )}
            </div>
            <div className="flex-1 pt-1">
              <p className="text-lg font-semibold text-gray-900">{message}</p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

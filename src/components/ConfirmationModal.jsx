import { AlertCircle } from "lucide-react";

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  isLoading = false,
  type = "default",
}) {
  if (!isOpen) return null;

  const getConfirmButtonColor = () => {
    const colors = {
      default: "bg-indigo-600 hover:bg-indigo-700",
      danger: "bg-red-600 hover:bg-red-700",
      success: "bg-green-600 hover:bg-green-700",
    };
    return colors[type] || colors.default;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 animate-in fadeIn zoom-in-95">
        <div className="flex items-start gap-4 mb-4">
          {type === "danger" && (
            <div className="flex-shrink-0">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
          )}
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          </div>
        </div>
        <p className="text-gray-600 mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-6 py-2 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-6 py-2 rounded-xl text-white font-semibold disabled:opacity-50 transition-colors ${getConfirmButtonColor()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

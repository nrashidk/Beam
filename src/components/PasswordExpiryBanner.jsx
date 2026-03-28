import React from "react";
import { AlertTriangle, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const PASSWORD_EXPIRY_WARNING_DAYS = 14;

export default function PasswordExpiryBanner() {
  const { passwordExpiresInDays } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = React.useState(false);

  if (
    dismissed ||
    passwordExpiresInDays == null ||
    passwordExpiresInDays > PASSWORD_EXPIRY_WARNING_DAYS ||
    passwordExpiresInDays <= 0
  ) {
    return null;
  }

  const isUrgent = passwordExpiresInDays <= 3;

  return (
    <div
      className={`flex items-center justify-between px-4 py-3 rounded-lg mb-4 text-sm font-medium ${
        isUrgent
          ? "bg-red-50 border border-red-300 text-red-800"
          : "bg-amber-50 border border-amber-300 text-amber-800"
      }`}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className={isUrgent ? "text-red-500" : "text-amber-500"} />
        <span>
          Your password expires in{" "}
          <strong>{passwordExpiresInDays} day{passwordExpiresInDays === 1 ? "" : "s"}</strong>.{" "}
          {isUrgent ? "Please change it immediately." : "Consider changing it soon to avoid being locked out."}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/settings")}
          className={`underline font-semibold hover:no-underline text-xs ${
            isUrgent ? "text-red-700" : "text-amber-700"
          }`}
        >
          Change Password
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="ml-1 text-gray-400 hover:text-gray-600"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

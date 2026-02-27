import React, { useState } from "react";
import { X, Mail, MessageSquare, Send, QrCode, Copy, Download,Phone } from "lucide-react";
import { apAPI } from "../lib/api";

export default function POSendModal({ isOpen, onClose, poId, onSuccess, poNumber }) {
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [contactInfo, setContactInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState(null);
  const [error, setError] = useState("");

  const sendMethods = [
    {
      id: "email",
      name: "Email",
      icon: Mail,
      description: "Send via email",
      placeholder: "supplier@example.com",
      type: "email",
    },
    {
      id: "sms",
      name: "SMS",
      icon: MessageSquare,
      description: "Send via SMS",
      placeholder: "+971501234567",
      type: "tel",
    },
    {
      id: "whatsapp",
      name: "WhatsApp",
      icon: Phone,
      description: "Send via WhatsApp",
      placeholder: "+971501234567",
      type: "tel",
    },
    {
      id: "qrcode",
      name: "QR Code",
      icon: QrCode,
      description: "Generate QR code",
      placeholder: null,
      type: null,
    },
  ];

  const resetModal = () => {
    setSelectedMethod(null);
    setContactInfo("");
    setQrCodeUrl(null);
    setError("");
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleGenerateQRCode = async () => {
    setLoading(true);
    setError("");
    try {
      // Generate QR code - this would be an API that returns a QR code
      // For now, we'll create a simple data URL
      const poLink = `${window.location.origin}/purchase-orders/${poId}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(poLink)}`;
      setQrCodeUrl(qrUrl);
    } catch (err) {
      setError("Failed to generate QR code");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!contactInfo && selectedMethod.type) {
      setError("Please enter a valid contact information");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const payload = {
        method: selectedMethod.id,
        contact: contactInfo,
      };

      await apAPI.sendPurchaseOrder(poId, payload);

      // Success message
      alert(`PO ${poNumber} sent successfully via ${selectedMethod.name}!`);
      onSuccess();
      handleClose();
    } catch (err) {
      const message = err.response?.data?.detail || err.message;
      setError(`Failed to send: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyQRLink = () => {
    const link = `${window.location.origin}/purchase-orders/${poId}`;
    navigator.clipboard.writeText(link);
    alert("PO link copied to clipboard!");
  };

  const handleDownloadQR = () => {
    const link = document.createElement("a");
    link.href = qrCodeUrl;
    link.download = `PO-${poNumber}-QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4  overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Send Purchase Order</h2>
            <p className="text-sm text-gray-500 mt-1">PO #{poNumber}</p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!selectedMethod ? (
            // Method Selection
            <div className="grid grid-cols-2 gap-4">
              {sendMethods.map((method) => {
                const Icon = method.icon;
                return (
                  <button
                    key={method.id}
                    onClick={() => {
                      setSelectedMethod(method);
                      if (method.id === "qrcode") handleGenerateQRCode();
                    }}
                    className="p-4 border-2 border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left group"
                  >
                    <Icon className="w-8 h-8 text-indigo-600 mb-2 group-hover:scale-110 transition-transform" />
                    <p className="font-semibold text-gray-900">{method.name}</p>
                    <p className="text-xs text-gray-500">{method.description}</p>
                  </button>
                );
              })}
            </div>
          ) : selectedMethod.id === "qrcode" ? (
            // QR Code Display
            <div className="text-center space-y-4">
              {qrCodeUrl && (
                <>
                  <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-6 inline-block">
                    <img
                      src={qrCodeUrl}
                      alt="PO QR Code"
                      className="w-48 h-48"
                    />
                  </div>
                  <p className="text-sm text-gray-600">
                    Scan this QR code to view the purchase order
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={handleCopyQRLink}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 font-medium"
                    >
                      <Copy className="w-4 h-4" />
                      Copy Link
                    </button>
                    <button
                      onClick={handleDownloadQR}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                </>
              )}
              {loading && (
                <div className="flex justify-center">
                  <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                </div>
              )}
            </div>
          ) : (
            // Contact Form
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Send via {selectedMethod.name}
                </label>
                <input
                  type={selectedMethod.type}
                  placeholder={selectedMethod.placeholder}
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                <p className="text-sm text-blue-800">
                  📧 <strong>Note:</strong> You will receive a copy of this communication in your email.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200 justify-end">
          <button
            onClick={handleClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
          >
            Cancel
          </button>
          {selectedMethod && selectedMethod.id !== "qrcode" && (
            <button
              onClick={handleSend}
              disabled={loading || (selectedMethod.type && !contactInfo)}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium inline-flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send
                </>
              )}
            </button>
          )}
          {selectedMethod && selectedMethod.id !== "qrcode" && (
            <button
              onClick={() => setSelectedMethod(null)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
            >
              Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

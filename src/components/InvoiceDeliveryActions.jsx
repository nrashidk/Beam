import React, { useState } from "react";
import {
  QrCode,
  Mail,
  MessageSquare,
  Phone,
  Download,
  X,
  Check,
  Loader,
} from "lucide-react";
import apiClient from "../lib/api";

export default function InvoiceDeliveryActions({ invoice }) {
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showSMSModal, setShowSMSModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [qrSrc, setQrSrc] = useState(null);
  const [shareUrl, setShareUrl] = useState("");
  const [copyToast, setCopyToast] = useState("");

  const [emailAddress, setEmailAddress] = useState(
    invoice.customer_email || "",
  );
  const [phoneNumber, setPhoneNumber] = useState("");

  const API_URL = import.meta.env.PROD
    ? ""
    : import.meta.env.VITE_API_URL || "http://localhost:8000";

  const showQRCode = async () => {
    setError("");
    setSuccess("");
    setQrSrc(null);
    setShareUrl("");
    setShowQRModal(true);

    try {
      let shareToken = invoice.share_token || "";

      if (!shareToken) {
        setLoading(true);
        const resp = await apiClient.post(`/invoices/${invoice.id}/share`);
        shareToken = resp?.data?.share_token || "";
      }

      // Use a frontend-only route to avoid opening raw API JSON when scanned directly.
      const publicUrl = shareToken
        ? `${window.location.origin}/invoice-view/${shareToken}`
        : null;

      if (publicUrl) {
        setShareUrl(publicUrl);
        const qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(publicUrl)}`;
        setQrSrc(qrImage);
      } else {
        setQrSrc(null);
      }
    } catch (err) {
      console.error("Failed to ensure share link:", err);
      setError(err.response?.data?.detail || "Failed to generate share link");
    } finally {
      setLoading(false);
    }
  };

  const copyShareLink = async () => {
    if (!shareUrl) {
      setError("Share link is not available yet");
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setSuccess("Invoice link copied to clipboard");
      setCopyToast("Invoice link copied to clipboard");
      setTimeout(() => {
        setSuccess("");
        setCopyToast("");
      }, 2000);
    } catch {
      setError("Failed to copy link");
    }
  };

  const downloadQRCode = async () => {
    if (!qrSrc) {
      setError("QR code is not available");
      return;
    }

    try {
      const response = await fetch(qrSrc);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `invoice-${invoice.invoice_number}-qr.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(qrSrc, "_blank", "noopener,noreferrer");
    }
  };

  const sendEmail = async () => {
    if (!emailAddress) {
      setError("Please enter an email address");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await apiClient.post(`/invoices/${invoice.id}/email`, null, {
        params: { recipient_email: emailAddress },
      });
      setSuccess("Email sent successfully!");
      setTimeout(() => {
        setShowEmailModal(false);
        setSuccess("");
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to send email");
    } finally {
      setLoading(false);
    }
  };

  const sendSMS = async () => {
    if (!phoneNumber) {
      setError("Please enter a phone number");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await apiClient.post(`/invoices/${invoice.id}/sms`, null, {
        params: { phone_number: phoneNumber },
      });
      setSuccess("SMS sent successfully!");
      setTimeout(() => {
        setShowSMSModal(false);
        setSuccess("");
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to send SMS");
    } finally {
      setLoading(false);
    }
  };

  const sendWhatsApp = async () => {
    if (!phoneNumber) {
      setError("Please enter a phone number");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await apiClient.post(`/invoices/${invoice.id}/whatsapp`, null, {
        params: { phone_number: phoneNumber },
      });
      setSuccess("WhatsApp message sent successfully!");
      setTimeout(() => {
        setShowWhatsAppModal(false);
        setSuccess("");
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to send WhatsApp message");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            showQRCode();
          }}
          className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
          title="Show QR Code"
        >
          <QrCode className="h-4 w-4" />
          QR Code
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setError("");
            setSuccess("");
            setShowEmailModal(true);
          }}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          title="Email Invoice"
        >
          <Mail className="h-4 w-4" />
          Email
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setError("");
            setSuccess("");
            setShowSMSModal(true);
          }}
          className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          title="Send via SMS"
        >
          <MessageSquare className="h-4 w-4" />
          SMS
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setError("");
            setSuccess("");
            setShowWhatsAppModal(true);
          }}
          className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
          title="Send via WhatsApp"
        >
          <Phone className="h-4 w-4" />
          WhatsApp
        </button>
      </div>

      {/* QR Code Modal */}
      {showQRModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowQRModal(false)}
        >
          <div
            className="bg-white rounded-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                Invoice QR Code
              </h3>
              <button
                onClick={() => setShowQRModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="text-center">
              <div className="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block">
                {qrSrc ? (
                  <img
                    src={qrSrc}
                    alt="Invoice QR Code"
                    className="w-64 h-64"
                    onError={(e) => {
                      e.target.src =
                        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="%23f3f4f6"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%239ca3af">QR Code</text></svg>';
                    }}
                  />
                ) : (
                  <div className="w-64 h-64 flex items-center justify-center text-sm text-gray-600">
                    Share link not available for this invoice. Please send the
                    invoice or generate a share link first.
                  </div>
                )}
              </div>
              {qrSrc && (
                <div className="flex gap-2 justify-center mt-4">
                  <button
                    onClick={copyShareLink}
                    className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg"
                  >
                    Copy Link
                  </button>
                  <button
                    onClick={downloadQRCode}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-lg"
                  >
                    Download
                  </button>
                </div>
              )}
              {shareUrl && (
                <p className="text-xs text-blue-700 mt-3 break-all">
                  {shareUrl}
                </p>
              )}
              <p className="text-sm text-gray-600 mt-4">
                Customer can scan this QR code to view the invoice
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Invoice: {invoice.invoice_number}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowEmailModal(false)}
        >
          <div
            className="bg-white rounded-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Email Invoice</h3>
              <button
                onClick={() => setShowEmailModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recipient Email
                </label>
                <input
                  type="email"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  placeholder="customer@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  {success}
                </div>
              )}
              <button
                onClick={sendEmail}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {loading ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Send Email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMS Modal */}
      {showSMSModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowSMSModal(false)}
        >
          <div
            className="bg-white rounded-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Send via SMS</h3>
              <button
                onClick={() => setShowSMSModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+971 50 123 4567"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  {success}
                </div>
              )}
              <button
                onClick={sendSMS}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                {loading ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-4 w-4" />
                    Send SMS
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Modal */}
      {showWhatsAppModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowWhatsAppModal(false)}
        >
          <div
            className="bg-white rounded-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                Send via WhatsApp
              </h3>
              <button
                onClick={() => setShowWhatsAppModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  WhatsApp Number
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+971 50 123 4567"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  {success}
                </div>
              )}
              <button
                onClick={sendWhatsApp}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-400"
              >
                {loading ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Phone className="h-4 w-4" />
                    Send WhatsApp
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {copyToast && (
        <div className="fixed bottom-4 right-4 z-[60] bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium">
          {copyToast}
        </div>
      )}
    </>
  );
}

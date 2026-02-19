import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../lib/api";
import {
  FileText,
  Plus,
  Send,
  Mail,
  MessageSquare,
  Phone,
  CheckCircle,
  Clock,
  XCircle,
  X,
} from "lucide-react";
import InvoiceDeliveryActions from "../components/InvoiceDeliveryActions";
import Sidebar from "../components/Sidebar";
import PageLoader from "../components/PageLoader";

export default function InvoiceDashboard() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [bulkSuccess, setBulkSuccess] = useState("");
  const [showBulkEmailModal, setShowBulkEmailModal] = useState(false);
  const [showBulkSmsModal, setShowBulkSmsModal] = useState(false);
  const [showBulkWhatsAppModal, setShowBulkWhatsAppModal] = useState(false);
  const [bulkEmailAddress, setBulkEmailAddress] = useState("");
  const [bulkPhoneNumber, setBulkPhoneNumber] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    loadInvoices();
  }, [filter, typeFilter]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (filter !== "all") {
        queryParams.append("status", filter);
      }
      if (typeFilter !== "all") {
        queryParams.append("invoice_type", typeFilter);
      }
      const params = queryParams.toString() ? `?${queryParams.toString()}` : "";
      const response = await apiClient.get(`/invoices${params}`);
      setInvoices(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Failed to load invoices:", error);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "DRAFT":
        return <Clock className="w-4 h-4 text-gray-400" />;
      case "ISSUED":
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case "SENT":
        return <Send className="w-4 h-4 text-green-500" />;
      case "PAID":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "CANCELLED":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      DRAFT: "bg-gray-100 text-gray-700",
      ISSUED: "bg-blue-100 text-blue-700",
      SENT: "bg-green-100 text-green-700",
      PAID: "bg-green-100 text-green-800",
      CANCELLED: "bg-red-100 text-red-700",
      OVERDUE: "bg-orange-100 text-orange-700",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  const selectedInvoices = invoices.filter((invoice) =>
    selectedIds.includes(invoice.id),
  );
  const allSelected =
    invoices.length > 0 && selectedIds.length === invoices.length;

  const toggleSelected = (invoiceId) => {
    setSelectedIds((prev) =>
      prev.includes(invoiceId)
        ? prev.filter((id) => id !== invoiceId)
        : [...prev, invoiceId],
    );
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(invoices.map((invoice) => invoice.id));
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setBulkError("");
  };

  const runBulkAction = async (action, items, apiCall) => {
    if (items.length === 0) {
      setBulkError(`No invoices available for ${action}.`);
      return 0;
    }

    setBulkLoading(true);
    setBulkError("");

    const results = await Promise.allSettled(items.map(apiCall));
    const failed = results.filter((result) => result.status === "rejected");

    if (failed.length > 0) {
      setBulkError(
        `${failed.length} ${action} action(s) failed. Please retry.`,
      );
    }

    await loadInvoices();
    setBulkLoading(false);
    if (failed.length === 0) {
      clearSelection();
    }

    return failed.length;
  };

  const handleBulkIssue = async () => {
    const draftInvoices = selectedInvoices.filter(
      (invoice) => invoice.status === "DRAFT",
    );
    const nonDraftCount = selectedInvoices.length - draftInvoices.length;

    if (draftInvoices.length === 0) {
      setBulkError(
        "Only draft invoices can be issued. Please select draft invoices.",
      );
      return;
    }

    if (nonDraftCount > 0) {
      setBulkError(
        `${nonDraftCount} invoice(s) skipped - only draft invoices can be issued.`,
      );
    }

    await runBulkAction("issue", draftInvoices, (invoice) =>
      apiClient.post(`/invoices/${invoice.id}/issue`),
    );
  };

  const handleBulkCancel = async () => {
    const paidInvoices = selectedInvoices.filter(
      (invoice) => invoice.status === "PAID",
    );
    const cancelledInvoices = selectedInvoices.filter(
      (invoice) => invoice.status === "CANCELLED",
    );
    const cancellableInvoices = selectedInvoices.filter(
      (invoice) => invoice.status !== "CANCELLED" && invoice.status !== "PAID",
    );

    if (paidInvoices.length > 0) {
      setBulkError(
        `${paidInvoices.length} paid invoice(s) can't be cancelled.`,
      );
      return;
    }

    if (cancellableInvoices.length === 0) {
      if (cancelledInvoices.length > 0) {
        setBulkError("Selected invoice(s) are already cancelled.");
      } else {
        setBulkError("No cancellable invoices selected.");
      }
      return;
    }

    await runBulkAction("cancel", cancellableInvoices, (invoice) =>
      apiClient.post(`/invoices/${invoice.id}/cancel`),
    );
  };

  const handleBulkEmail = async () => {
    if (!bulkEmailAddress) {
      setBulkError("Please enter an email address for bulk email.");
      return;
    }

    const draftInvoices = selectedInvoices.filter(
      (invoice) => invoice.status === "DRAFT",
    );
    const cancelledInvoices = selectedInvoices.filter(
      (invoice) => invoice.status === "CANCELLED",
    );
    const eligibleInvoices = selectedInvoices.filter(
      (invoice) => invoice.status !== "DRAFT" && invoice.status !== "CANCELLED",
    );
    const skippedCount = selectedInvoices.length - eligibleInvoices.length;

    if (eligibleInvoices.length === 0) {
      if (draftInvoices.length > 0 && cancelledInvoices.length > 0) {
        setBulkError("Draft and cancelled invoices can't be emailed.");
      } else if (draftInvoices.length > 0) {
        setBulkError("Draft invoices can't be emailed.");
      } else if (cancelledInvoices.length > 0) {
        setBulkError("Cancelled invoices can't be emailed.");
      } else {
        setBulkError("Only issued/sent/paid invoices can be emailed.");
      }
      return;
    }

    const failedCount = await runBulkAction(
      "email",
      eligibleInvoices,
      (invoice) =>
        apiClient.post(`/invoices/${invoice.id}/email`, null, {
          params: { recipient_email: bulkEmailAddress },
        }),
    );

    if (skippedCount > 0 && failedCount === 0) {
      setBulkError(`${skippedCount} draft/cancelled invoice(s) were skipped.`);
    }
    if (failedCount === 0) {
      setBulkSuccess("Email sent successfully!");
      setTimeout(() => {
        setShowBulkEmailModal(false);
        setBulkEmailAddress("");
        setBulkSuccess("");
      }, 1500);
    }
  };

  const handleBulkSms = async () => {
    if (!bulkPhoneNumber) {
      setBulkError("Please enter a phone number for bulk SMS.");
      return;
    }

    const draftInvoices = selectedInvoices.filter(
      (invoice) => invoice.status === "DRAFT",
    );
    const cancelledInvoices = selectedInvoices.filter(
      (invoice) => invoice.status === "CANCELLED",
    );
    const eligibleInvoices = selectedInvoices.filter(
      (invoice) => invoice.status !== "DRAFT" && invoice.status !== "CANCELLED",
    );
    const skippedCount = selectedInvoices.length - eligibleInvoices.length;

    if (eligibleInvoices.length === 0) {
      if (draftInvoices.length > 0 && cancelledInvoices.length > 0) {
        setBulkError("Draft and cancelled invoices can't be sent via SMS.");
      } else if (draftInvoices.length > 0) {
        setBulkError("Draft invoices can't be sent via SMS.");
      } else if (cancelledInvoices.length > 0) {
        setBulkError("Cancelled invoices can't be sent via SMS.");
      } else {
        setBulkError("Only issued/sent/paid invoices can be sent by SMS.");
      }
      return;
    }

    const failedCount = await runBulkAction(
      "SMS",
      eligibleInvoices,
      (invoice) =>
        apiClient.post(`/invoices/${invoice.id}/sms`, null, {
          params: { phone_number: bulkPhoneNumber },
        }),
    );

    if (skippedCount > 0 && failedCount === 0) {
      setBulkError(`${skippedCount} draft/cancelled invoice(s) were skipped.`);
    }
    if (failedCount === 0) {
      setBulkSuccess("SMS sent successfully!");
      setTimeout(() => {
        setShowBulkSmsModal(false);
        setBulkPhoneNumber("");
        setBulkSuccess("");
      }, 1500);
    }
  };

  const handleBulkWhatsApp = async () => {
    if (!bulkPhoneNumber) {
      setBulkError("Please enter a phone number for bulk WhatsApp.");
      return;
    }

    const draftInvoices = selectedInvoices.filter(
      (invoice) => invoice.status === "DRAFT",
    );
    const cancelledInvoices = selectedInvoices.filter(
      (invoice) => invoice.status === "CANCELLED",
    );
    const eligibleInvoices = selectedInvoices.filter(
      (invoice) => invoice.status !== "DRAFT" && invoice.status !== "CANCELLED",
    );
    const skippedCount = selectedInvoices.length - eligibleInvoices.length;

    if (eligibleInvoices.length === 0) {
      if (draftInvoices.length > 0 && cancelledInvoices.length > 0) {
        setBulkError(
          "Draft and cancelled invoices can't be sent via WhatsApp.",
        );
      } else if (draftInvoices.length > 0) {
        setBulkError("Draft invoices can't be sent via WhatsApp.");
      } else if (cancelledInvoices.length > 0) {
        setBulkError("Cancelled invoices can't be sent via WhatsApp.");
      } else {
        setBulkError("Only issued/sent/paid invoices can be sent by WhatsApp.");
      }
      return;
    }

    const failedCount = await runBulkAction(
      "WhatsApp",
      eligibleInvoices,
      (invoice) =>
        apiClient.post(`/invoices/${invoice.id}/whatsapp`, null, {
          params: { phone_number: bulkPhoneNumber },
        }),
    );

    if (skippedCount > 0 && failedCount === 0) {
      setBulkError(`${skippedCount} draft/cancelled invoice(s) were skipped.`);
    }
    if (failedCount === 0) {
      setBulkSuccess("WhatsApp message sent successfully!");
      setTimeout(() => {
        setShowBulkWhatsAppModal(false);
        setBulkPhoneNumber("");
        setBulkSuccess("");
      }, 1500);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />

      <div className="flex-1 ml-64">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
              <p className="text-gray-600 mt-1">
                Create and manage UAE-compliant e-invoices
              </p>
            </div>
            <button
              onClick={() => navigate("/invoices/create")}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
            >
              <Plus className="w-5 h-5" />
              Create Invoice
            </button>
          </div>

          {/* Filters */}
          <div className="space-y-4 mt-6">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Filter by Status
              </label>
              <div className="flex gap-3 flex-wrap">
                {["all", "DRAFT", "ISSUED", "SENT", "PAID", "CANCELLED"].map(
                  (status) => (
                    <button
                      key={status}
                      onClick={() => setFilter(status)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        filter === status
                          ? "bg-indigo-600 text-white shadow-md"
                          : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
                      }`}
                    >
                      {status === "all"
                        ? "All"
                        : status.charAt(0) + status.slice(1).toLowerCase()}
                    </button>
                  ),
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Filter by Invoice Type
              </label>
              <div className="flex gap-3 flex-wrap">
                {[
                  { value: "all", label: "All Types" },
                  { value: "380", label: "Tax Invoice" },
                  { value: "381", label: "Credit Note" },
                  { value: "480", label: "Commercial" },
                ].map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setTypeFilter(type.value)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      typeFilter === type.value
                        ? "bg-purple-600 text-white shadow-md"
                        : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Invoice List */}

          {selectedIds.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="h-4 w-4"
                />
                Select all
              </label>
              <span className="text-sm font-semibold text-gray-700 mr-2">
                {selectedIds.length} selected
              </span>
              <button
                onClick={handleBulkIssue}
                disabled={bulkLoading}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" />
                Issue
              </button>
              <button
                onClick={handleBulkCancel}
                disabled={bulkLoading}
                className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                Cancel
              </button>
              <button
                onClick={() => {
                  setBulkError("");
                  setBulkSuccess("");
                  setShowBulkEmailModal(true);
                }}
                disabled={bulkLoading}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
              >
                <Mail className="h-4 w-4" />
                Email
              </button>
              <button
                onClick={() => {
                  setBulkError("");
                  setBulkSuccess("");
                  setShowBulkSmsModal(true);
                }}
                disabled={bulkLoading}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50"
              >
                <MessageSquare className="h-4 w-4" />
                SMS
              </button>
              <button
                onClick={() => {
                  setBulkError("");
                  setBulkSuccess("");
                  setShowBulkWhatsAppModal(true);
                }}
                disabled={bulkLoading}
                className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm disabled:opacity-50"
              >
                <Phone className="h-4 w-4" />
                WhatsApp
              </button>
              <button
                onClick={clearSelection}
                disabled={bulkLoading}
                className="ml-auto text-sm text-gray-600 hover:text-gray-900"
              >
                Clear
              </button>
              {bulkError && (
                <div className="w-full text-sm text-red-600">{bulkError}</div>
              )}
            </div>
          )}
          {loading ? (
            <PageLoader />
          ) : invoices.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No invoices found
              </h3>
              <p className="text-gray-600 mb-6">
                {filter === "all"
                  ? "Create your first UAE-compliant e-invoice"
                  : `No invoices with status: ${filter}`}
              </p>
              <button
                onClick={() => navigate("/invoices/create")}
                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all"
              >
                <Plus className="w-5 h-5" />
                Create Invoice
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all border border-gray-100 cursor-pointer"
                  onClick={() => navigate(`/invoices/${invoice.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(invoice.id)}
                        onChange={() => toggleSelected(invoice.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4"
                      />
                      <div className="p-3 bg-indigo-50 rounded-xl">
                        <FileText className="w-6 h-6 text-indigo-600" />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-bold text-gray-900">
                            {invoice.invoice_number}
                          </h3>
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(invoice.status)}`}
                          >
                            {getStatusIcon(invoice.status)}
                            {invoice.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="font-medium">
                            {invoice.customer_name}
                          </span>
                          <span>•</span>
                          <span>
                            {new Date(invoice.issue_date).toLocaleDateString(
                              "en-AE",
                            )}
                          </span>
                          <span>•</span>
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                            Type:{" "}
                            {invoice.invoice_type === "380"
                              ? "Tax Invoice"
                              : invoice.invoice_type === "381"
                                ? "Credit Note"
                                : invoice.invoice_type === "480"
                                  ? "Commercial"
                                  : "Other"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">
                        {invoice.currency_code}{" "}
                        {invoice.total_amount.toFixed(2)}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        Created{" "}
                        {new Date(invoice.created_at).toLocaleDateString(
                          "en-AE",
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Delivery Actions - Only show for issued/sent invoices */}
                  {invoice.status !== "DRAFT" &&
                    invoice.status !== "CANCELLED" && (
                      <div
                        className="mt-4 pt-4 border-t border-gray-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <InvoiceDeliveryActions invoice={invoice} />
                      </div>
                    )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showBulkSmsModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => {
            setShowBulkSmsModal(false);
            setBulkPhoneNumber("");
            setBulkSuccess("");
          }}
        >
          <div
            className="bg-white rounded-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Bulk SMS</h3>
              <button
                onClick={() => {
                  setShowBulkSmsModal(false);
                  setBulkPhoneNumber("");
                  setBulkSuccess("");
                }}
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
                  value={bulkPhoneNumber}
                  onChange={(e) => setBulkPhoneNumber(e.target.value)}
                  placeholder="+971 50 123 4567"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              {bulkError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {bulkError}
                </div>
              )}
              {bulkSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {bulkSuccess}
                </div>
              )}
              <button
                onClick={handleBulkSms}
                disabled={bulkLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                <MessageSquare className="h-4 w-4" />
                Send SMS
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkEmailModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => {
            setShowBulkEmailModal(false);
            setBulkEmailAddress("");
            setBulkSuccess("");
          }}
        >
          <div
            className="bg-white rounded-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Bulk Email</h3>
              <button
                onClick={() => {
                  setShowBulkEmailModal(false);
                  setBulkEmailAddress("");
                  setBulkSuccess("");
                }}
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
                  value={bulkEmailAddress}
                  onChange={(e) => setBulkEmailAddress(e.target.value)}
                  placeholder="customer@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              {bulkError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {bulkError}
                </div>
              )}
              {bulkSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {bulkSuccess}
                </div>
              )}
              <button
                onClick={handleBulkEmail}
                disabled={bulkLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                <Mail className="h-4 w-4" />
                Send Email
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkWhatsAppModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => {
            setShowBulkWhatsAppModal(false);
            setBulkPhoneNumber("");
            setBulkSuccess("");
          }}
        >
          <div
            className="bg-white rounded-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Bulk WhatsApp</h3>
              <button
                onClick={() => {
                  setShowBulkWhatsAppModal(false);
                  setBulkPhoneNumber("");
                  setBulkSuccess("");
                }}
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
                  value={bulkPhoneNumber}
                  onChange={(e) => setBulkPhoneNumber(e.target.value)}
                  placeholder="+971 50 123 4567"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              {bulkError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {bulkError}
                </div>
              )}
              {bulkSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {bulkSuccess}
                </div>
              )}
              <button
                onClick={handleBulkWhatsApp}
                disabled={bulkLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-400"
              >
                <Phone className="h-4 w-4" />
                Send WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

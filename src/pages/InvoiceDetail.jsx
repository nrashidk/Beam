import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiClient } from "../lib/api";
import {
  ArrowLeft,
  Send,
  CheckCircle,
  XCircle,
  Share2,
  Download,
  FileText,
  Edit2,
  Lock,
} from "lucide-react";
import Toast from "../components/ui/Toast";
import PageLoader from "../components/PageLoader";
import ConfirmationModal from "../components/ConfirmationModal";

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [lockedModal, setLockedModal] = useState({
    isOpen: false,
    title: "",
    message: "",
  });
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    action: null,
    title: "",
    message: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    type: "default",
  });

  useEffect(() => {
    loadInvoice();
  }, [id]);

  const loadInvoice = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/invoices/${id}`);
      setInvoice(response.data);
    } catch (error) {
      console.error("Failed to load invoice:", error);
      setToast({
        message: "Failed to load invoice",
        type: "error",
        onClose: () => {
          setToast(null);
          navigate("/invoices");
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleIssue = async () => {
    setConfirmModal({
      isOpen: true,
      action: "issue",
      title: "Issue Invoice",
      message:
        "Issue this invoice? This will generate UBL XML and increment your invoice counter.",
      confirmText: "Issue",
      cancelText: "Cancel",
      type: "default",
    });
  };

  const handleSend = async () => {
    if (!invoice.customer_email) {
      setToast({
        message: "Cannot send invoice: Customer email is required.",
        type: "error",
        onClose: () => setToast(null),
      });
      return;
    }

    setConfirmModal({
      isOpen: true,
      action: "send",
      title: "Send Invoice",
      message: `Send this invoice to ${invoice.customer_email}? This will send via email and update the status to SENT.`,
      confirmText: "Send",
      cancelText: "Cancel",
      type: "default",
    });
  };

  const handleEditClick = () => {
    if (invoice.status !== "DRAFT") {
      setLockedModal({
        isOpen: true,
        title: "Invoice is Locked",
        message:
          `This invoice has status "${invoice.status}" and cannot be edited. ` +
          "Posted invoices are locked to preserve the audit trail. " +
          "To correct this invoice, please create a Credit Note (document type 381) referencing it.",
      });
      return;
    }
    navigate(`/invoices/${id}/edit`);
  };

  const handleCancel = async () => {
    if (invoice.status === "ISSUED" || invoice.status === "SENT") {
      setConfirmModal({
        isOpen: true,
        action: "cancel",
        title: "Cancel Posted Invoice",
        message:
          "To cancel a posted invoice, a Credit Note must already exist for it. " +
          "If no credit note exists, cancellation will be blocked. Continue?",
        confirmText: "Try Cancel",
        cancelText: "Back",
        type: "danger",
      });
    } else {
      setConfirmModal({
        isOpen: true,
        action: "cancel",
        title: "Cancel Invoice",
        message: "Cancel this invoice? This action cannot be undone.",
        confirmText: "Cancel Invoice",
        cancelText: "Keep it",
        type: "danger",
      });
    }
  };

  const executeAction = async () => {
    const { action } = confirmModal;
    setConfirmModal({ ...confirmModal, isOpen: false });

    setActionLoading(true);
    try {
      if (action === "issue") {
        await apiClient.post(`/invoices/${id}/issue`);
        setToast({
          message: "Invoice issued successfully! UBL XML generated.",
          type: "success",
          onClose: () => {
            setToast(null);
            loadInvoice();
          },
        });
      } else if (action === "send") {
        const response = await apiClient.post(`/invoices/${id}/send`);
        setToast({
          message: `Invoice sent successfully! Customer share link: ${window.location.origin}/invoices/view/${invoice.share_token}`,
          type: "success",
          onClose: () => {
            setToast(null);
            loadInvoice();
          },
        });
      } else if (action === "cancel") {
        await apiClient.post(`/invoices/${id}/cancel`);
        setToast({
          message: "Invoice cancelled",
          type: "success",
          onClose: () => {
            setToast(null);
            loadInvoice();
          },
        });
      }
    } catch (error) {
      const status = error.response?.status;
      const detail =
        error.response?.data?.detail || `Failed to ${action} invoice`;
      if (status === 409) {
        setLockedModal({
          isOpen: true,
          title: "Action Blocked",
          message: detail,
        });
      } else {
        setToast({
          message: detail,
          type: "error",
          onClose: () => setToast(null),
        });
      }
    } finally {
      setActionLoading(false);
    }
  };

  const closeConfirmModal = () => {
    setConfirmModal({ ...confirmModal, isOpen: false });
  };

  const copyShareLink = () => {
    const link = `${window.location.origin}/invoices/view/${invoice.share_token}`;
    navigator.clipboard.writeText(link);
    setToast({
      message: "Share link copied to clipboard!",
      type: "success",
      onClose: () => setToast(null),
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      DRAFT: "bg-gray-100 text-gray-700",
      ISSUED: "bg-blue-100 text-blue-700",
      SENT: "bg-green-100 text-green-700",
      PAID: "bg-green-100 text-green-800",
      CANCELLED: "bg-red-100 text-red-700",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  const getInvoiceTypeName = (type) => {
    const types = {
      380: "Tax Invoice",
      381: "Tax Credit Note",
      383: "Debit Note",
      480: "Commercial Invoice",
      81: "Credit Note (Out of Scope)",
    };
    return types[type] || type;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <PageLoader />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Invoice not found
          </h2>
          <button
            onClick={() => navigate("/invoices")}
            className="text-indigo-600 hover:text-indigo-700 font-medium"
          >
            ← Back to Invoices
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <button
          onClick={() => navigate("/invoices")}
          className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Invoices
        </button>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Invoice Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 text-white">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                {/* Company Logo */}
                <img
                  src={`${import.meta.env.PROD ? "" : import.meta.env.VITE_API_URL || "http://localhost:8000"}/companies/${invoice.company_id}/branding/logo`}
                  alt="Company Logo"
                  className="h-16 w-16 object-contain bg-white rounded-lg p-2"
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                />
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-bold">
                      {invoice.invoice_number}
                    </h1>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(invoice.status)}`}
                    >
                      {invoice.status}
                    </span>
                  </div>
                  <p className="text-indigo-100">
                    {getInvoiceTypeName(invoice.invoice_type)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold">
                  {invoice.currency_code} {invoice.total_amount.toFixed(2)}
                </div>
                <p className="text-indigo-100 mt-1">Total Amount</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-6 bg-gray-50 border-b flex gap-3">
            {invoice.status !== "CANCELLED" && invoice.status !== "PAID" && (
              <button
                onClick={handleEditClick}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold ${
                  invoice.status === "DRAFT"
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                }`}
                title={
                  invoice.status !== "DRAFT"
                    ? "Invoice is locked — click to learn more"
                    : "Edit invoice"
                }
              >
                {invoice.status === "DRAFT" ? (
                  <Edit2 className="w-5 h-5" />
                ) : (
                  <Lock className="w-5 h-5" />
                )}
                {invoice.status === "DRAFT" ? "Edit Invoice" : "Locked"}
              </button>
            )}

            {invoice.status === "DRAFT" && (
              <button
                onClick={handleIssue}
                disabled={actionLoading}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                <CheckCircle className="w-5 h-5" />
                Issue Invoice
              </button>
            )}

            {invoice.status === "ISSUED" && (
              <button
                onClick={handleSend}
                disabled={actionLoading}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
                Send to Customer
              </button>
            )}

            {(invoice.status === "SENT" || invoice.status === "ISSUED") && (
              <button
                onClick={copyShareLink}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700"
              >
                <Share2 className="w-5 h-5" />
                Copy Share Link
              </button>
            )}

            {/* Credit Note & Debit Note quick actions for posted tax invoices */}
            {(invoice.status === "ISSUED" ||
              invoice.status === "SENT" ||
              invoice.status === "VIEWED") &&
              invoice.invoice_type === "380" && (
                <>
                  <button
                    onClick={() =>
                      navigate(
                        `/invoices/create?preceding_invoice_id=${id}&type=credit_note`,
                      )
                    }
                    className="flex items-center gap-2 px-5 py-3 bg-amber-100 text-amber-800 rounded-xl font-semibold hover:bg-amber-200"
                    title="Issue a credit note against this invoice"
                  >
                    <FileText className="w-5 h-5" />
                    Credit Note
                  </button>
                  <button
                    onClick={() =>
                      navigate(
                        `/invoices/create?preceding_invoice_id=${id}&type=debit_note`,
                      )
                    }
                    className="flex items-center gap-2 px-5 py-3 bg-purple-100 text-purple-800 rounded-xl font-semibold hover:bg-purple-200"
                    title="Issue a debit note against this invoice"
                  >
                    <FileText className="w-5 h-5" />
                    Debit Note
                  </button>
                </>
              )}

            {invoice.status !== "CANCELLED" && invoice.status !== "PAID" && (
              <button
                onClick={handleCancel}
                disabled={actionLoading}
                className="flex items-center gap-2 px-6 py-3 bg-red-100 text-red-700 rounded-xl font-semibold hover:bg-red-200 disabled:opacity-50"
              >
                <XCircle className="w-5 h-5" />
                Cancel
              </button>
            )}
          </div>

          {/* Invoice Details */}
          <div className="p-8 space-y-8">
            {/* Parties */}
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                  From (Supplier)
                </h3>
                <div className="space-y-1">
                  <p className="font-bold text-gray-900">
                    {invoice.supplier_name}
                  </p>
                  <p className="text-gray-600 text-sm">
                    TRN: {invoice.supplier_trn}
                  </p>
                  {invoice.supplier_address && (
                    <p className="text-gray-600 text-sm">
                      {invoice.supplier_address}
                    </p>
                  )}
                  {invoice.supplier_city && (
                    <p className="text-gray-600 text-sm">
                      {invoice.supplier_city}
                    </p>
                  )}
                  {invoice.supplier_peppol_id && (
                    <p className="text-gray-600 text-sm">
                      Peppol ID: {invoice.supplier_peppol_id}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                  To (Customer)
                </h3>
                <div className="space-y-1">
                  <p className="font-bold text-gray-900">
                    {invoice.customer_name}
                  </p>
                  {invoice.customer_trn && (
                    <p className="text-gray-600 text-sm">
                      TRN: {invoice.customer_trn}
                    </p>
                  )}
                  {invoice.customer_email && (
                    <p className="text-gray-600 text-sm">
                      {invoice.customer_email}
                    </p>
                  )}
                  {invoice.customer_address && (
                    <p className="text-gray-600 text-sm">
                      {invoice.customer_address}
                    </p>
                  )}
                  {invoice.customer_city && (
                    <p className="text-gray-600 text-sm">
                      {invoice.customer_city}
                    </p>
                  )}
                  {invoice.customer_peppol_id && (
                    <p className="text-gray-600 text-sm">
                      Peppol ID: {invoice.customer_peppol_id}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Issue Date</p>
                <p className="font-semibold">
                  {new Date(invoice.issue_date).toLocaleDateString("en-AE")}
                </p>
              </div>
              {invoice.due_date && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Due Date</p>
                  <p className="font-semibold">
                    {new Date(invoice.due_date).toLocaleDateString("en-AE")}
                  </p>
                </div>
              )}
              {invoice.delivery_date && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Delivery Date</p>
                  <p className="font-semibold">
                    {new Date(invoice.delivery_date).toLocaleDateString("en-AE")}
                  </p>
                </div>
              )}
              {invoice.supply_date && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Supply Date</p>
                  <p className="font-semibold">
                    {new Date(invoice.supply_date).toLocaleDateString("en-AE")}
                  </p>
                </div>
              )}
              {invoice.sent_at && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Sent Date</p>
                  <p className="font-semibold">
                    {new Date(invoice.sent_at).toLocaleDateString("en-AE")}
                  </p>
                </div>
              )}
            </div>

            {/* UAE PINT-AE Transaction Type (Task 9) */}
            {invoice.invoice_transaction_type && invoice.invoice_transaction_type !== "STANDARD" && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-indigo-800 uppercase mb-3">UAE Transaction Scenario</h3>
                <div className="flex flex-wrap gap-2 items-center mb-3">
                  <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-semibold">
                    {invoice.invoice_transaction_type.replace(/_/g, " ")}
                  </span>
                  {invoice.mls_status && (
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      invoice.mls_status === "ACCEPTED" || invoice.mls_status === "DEEMED_ACCEPTED"
                        ? "bg-green-100 text-green-800"
                        : invoice.mls_status === "REJECTED"
                        ? "bg-red-100 text-red-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}>
                      MLS: {invoice.mls_status === "DEEMED_ACCEPTED" ? "Deemed Accepted (10 min)" : invoice.mls_status}
                    </span>
                  )}
                  {invoice.peppol_deemed_accepted && (
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                      Deemed Accepted — FTA 10-minute rule applied
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {invoice.tax_exemption_reason_code && (
                    <div><span className="text-gray-500">Exemption Code:</span> <span className="font-medium">{invoice.tax_exemption_reason_code}</span></div>
                  )}
                  {invoice.tax_exemption_reason && (
                    <div><span className="text-gray-500">Exemption Reason:</span> <span className="font-medium">{invoice.tax_exemption_reason}</span></div>
                  )}
                  {invoice.deliver_to_party_name && (
                    <div><span className="text-gray-500">Deliver To:</span> <span className="font-medium">{invoice.deliver_to_party_name}</span></div>
                  )}
                  {invoice.deliver_to_address && (
                    <div><span className="text-gray-500">Delivery Address:</span> <span className="font-medium">{invoice.deliver_to_address}</span></div>
                  )}
                  {invoice.delivery_date && (
                    <div><span className="text-gray-500">Delivery Date:</span> <span className="font-medium">{new Date(invoice.delivery_date).toLocaleDateString("en-AE")}</span></div>
                  )}
                  {invoice.buyer_legal_registration && (
                    <div><span className="text-gray-500">Buyer Registration:</span> <span className="font-medium">{invoice.buyer_legal_registration}</span></div>
                  )}
                  {invoice.contract_reference && (
                    <div><span className="text-gray-500">Contract Ref:</span> <span className="font-medium">{invoice.contract_reference}</span></div>
                  )}
                  {invoice.billing_frequency && (
                    <div><span className="text-gray-500">Billing Freq:</span> <span className="font-medium">{invoice.billing_frequency}</span></div>
                  )}
                  {invoice.invoicing_period_start && invoice.invoicing_period_end && (
                    <div className="col-span-2"><span className="text-gray-500">Invoicing Period:</span> <span className="font-medium">{new Date(invoice.invoicing_period_start).toLocaleDateString("en-AE")} – {new Date(invoice.invoicing_period_end).toLocaleDateString("en-AE")}</span></div>
                  )}
                  {invoice.principal_id && (
                    <div><span className="text-gray-500">Principal ID:</span> <span className="font-medium">{invoice.principal_id}</span></div>
                  )}
                  {invoice.beneficiary_id && (
                    <div><span className="text-gray-500">Beneficiary ID:</span> <span className="font-medium">{invoice.beneficiary_id}</span></div>
                  )}
                </div>
              </div>
            )}

            {/* Line Items */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Line Items
              </h3>
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                        #
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                        Item
                      </th>
                      <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">
                        Qty
                      </th>
                      <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">
                        Unit Price
                      </th>
                      <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">
                        Tax
                      </th>
                      <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {invoice.line_items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 text-sm">
                          {item.line_number}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">
                            {item.item_name}
                          </div>
                          {item.item_description && (
                            <div className="text-sm text-gray-500">
                              {item.item_description}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {invoice.currency_code} {item.unit_price.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {invoice.currency_code} {item.tax_amount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-right">
                          {invoice.currency_code}{" "}
                          {item.line_total_amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="border-t pt-6">
              <div className="space-y-2 max-w-md ml-auto">
                <div className="flex justify-between text-gray-700">
                  <span>Subtotal:</span>
                  <span className="font-semibold">
                    {invoice.currency_code} {invoice.subtotal_amount.toFixed(2)}
                  </span>
                </div>
                {invoice.tax_breakdowns.map((tb, idx) => (
                  <div key={idx} className="flex justify-between text-gray-700">
                    <span>
                      VAT ({tb.tax_category} - {tb.tax_percent}%):
                    </span>
                    <span className="font-semibold">
                      {invoice.currency_code} {tb.tax_amount.toFixed(2)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between text-2xl font-bold text-indigo-900 pt-3 border-t-2">
                  <span>Total:</span>
                  <span>
                    {invoice.currency_code} {invoice.total_amount.toFixed(2)}
                  </span>
                </div>
                {invoice.amount_due !== invoice.total_amount && (
                  <div className="flex justify-between text-xl font-bold text-green-700 pt-2 mt-2 border-t border-green-200 bg-green-50 px-3 py-2 rounded-lg">
                    <span>Amount Due:</span>
                    <span>
                      {invoice.currency_code} {invoice.amount_due.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Notes (optional) */}
            {(invoice.invoice_notes || invoice.notes) && (
              <div className="bg-white border rounded-xl p-6">
                <h3 className="text-sm font-semibold text-gray-900 uppercase mb-2">
                  Notes
                </h3>
                <div className="text-sm text-gray-700 whitespace-pre-line">
                  {invoice.invoice_notes || invoice.notes}
                </div>
              </div>
            )}

            {/* UBL XML Info */}
            {invoice.xml_file_path && (
              <div className="bg-indigo-50 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-indigo-900 uppercase mb-2">
                  UAE E-Invoicing Compliance
                </h3>
                <div className="space-y-1 text-sm">
                  <p className="text-indigo-700">
                    ✅ UBL 2.1 / PINT-AE XML Generated
                  </p>
                  <p className="text-indigo-700">
                    ✅ SHA-256 Hash:{" "}
                    <code className="font-mono text-xs">
                      {invoice.xml_hash?.substring(0, 32)}...
                    </code>
                  </p>
                  <p className="text-indigo-700">
                    ✅ Ready for ASP Transmission
                  </p>
                </div>
              </div>
            )}

            {/* Company Stamp/Seal */}
            <div className="flex justify-end pt-8">
              <div className="text-center">
                <img
                  src={`${import.meta.env.PROD ? "" : import.meta.env.VITE_API_URL || "http://localhost:8000"}/companies/${invoice.company_id}/branding/stamp`}
                  alt="Company Stamp"
                  className="h-24 w-24 object-contain mx-auto mb-2"
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                />
                <p className="text-xs text-gray-500">Authorized Signature</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        type={confirmModal.type}
        onConfirm={executeAction}
        onCancel={closeConfirmModal}
        isLoading={actionLoading}
      />

      {/* Locked Invoice Modal */}
      {lockedModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-amber-100 rounded-full">
                <Lock className="w-6 h-6 text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">
                {lockedModal.title}
              </h2>
            </div>
            <p className="text-gray-600 mb-6 leading-relaxed">
              {lockedModal.message}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() =>
                  setLockedModal({ isOpen: false, title: "", message: "" })
                }
                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setLockedModal({ isOpen: false, title: "", message: "" });
                  navigate(
                    `/invoices/create?preceding_invoice_id=${id}&type=credit_note`,
                  );
                }}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700"
              >
                Create Credit Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={toast.onClose}
        />
      )}
    </div>
  );
}

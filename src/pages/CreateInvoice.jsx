import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiClient } from "../lib/api";
import { EmailInput, TRNInput } from "../components/ui/validated-input";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  FileText,
  AlertCircle,
} from "lucide-react";
import Toast from "../components/ui/Toast";

const buildDefaultLineItem = (isVatEnabled) => ({
  item_name: "",
  item_description: "",
  quantity: 1,
  unit_price: 0,
  tax_category: isVatEnabled ? "S" : "O",
  tax_percent: isVatEnabled ? 5.0 : 0,
  tax_code: isVatEnabled ? "SR" : "OP",
});

const normalizeLineItemForVat = (item, isVatEnabled) => {
  if (!isVatEnabled) {
    return {
      ...item,
      tax_category: "O",
      tax_percent: 0,
      tax_code: "OP",
    };
  }

  const nextCategory = item.tax_category === "O" ? "S" : item.tax_category;
  const nextPercent = nextCategory === "S" ? item.tax_percent || 5.0 : 0;
  const nextTaxCode =
    item.tax_code ||
    (nextCategory === "S"
      ? "SR"
      : nextCategory === "Z"
        ? "ZR"
        : nextCategory === "E"
          ? "ES"
          : "OP");

  return {
    ...item,
    tax_category: nextCategory,
    tax_percent: nextPercent,
    tax_code: nextTaxCode,
  };
};

export default function CreateInvoice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [vatEnabled, setVatEnabled] = useState(false);
  const [loadingVatSettings, setLoadingVatSettings] = useState(true);
  const [originalInvoices, setOriginalInvoices] = useState([]);
  const [loadingOriginalInvoices, setLoadingOriginalInvoices] = useState(false);
  const [originalSearchQuery, setOriginalSearchQuery] = useState("");
  const [originalSuggestions, setOriginalSuggestions] = useState([]);
  const [showOriginalSuggestions, setShowOriginalSuggestions] = useState(false);
  const [originalHighlight, setOriginalHighlight] = useState(-1);

  const getDocumentTypeLabel = (type) => {
    const labels = {
      380: "Tax Invoice (380)",
      381: "Tax Credit Note (381)",
      383: "Debit Note (383)",
      480: "Commercial Invoice (480)",
      81: "Credit Note (81)",
    };
    return labels[type] || type;
  };

  const getDocumentTypeSuccessLabel = (type) => {
    const labels = {
      380: "Tax invoice",
      381: "Tax credit note",
      480: "Invoice",
      81: "Credit note",
    };
    return labels[type] || "Invoice";
  };

  // Get the valid credit note type for a given invoice type
  const getValidCreditNoteType = (invoiceType) => {
    if (invoiceType === "380") return "381"; // Tax Invoice → Tax Credit Note
    if (invoiceType === "480") return "81"; // Commercial Invoice → Credit Note
    return null;
  };

  // Check if a credit note type matches the original invoice type
  const isValidCreditNoteType = (originalType, creditNoteType) => {
    return getValidCreditNoteType(originalType) === creditNoteType;
  };

  const [formData, setFormData] = useState({
    invoice_type: "480", // Default to Commercial Invoice (safer for non-VAT companies)
    issue_date: new Date().toISOString().split("T")[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    delivery_date: "",
    currency_code: "AED",
    customer_name: "",
    customer_email: "",
    customer_trn: "",
    customer_address: "",
    customer_city: "",
    customer_country: "AE",
    payment_due_days: 30,
    invoice_notes: "",
    reference_number: "",
    preceding_invoice_id: "",
    line_items: [buildDefaultLineItem(false)],
    // UAE PINT-AE Transaction Type fields
    invoice_transaction_type: "STANDARD",
    tax_exemption_reason_code: "",
    tax_exemption_reason: "",
    payment_due_date: "",
    payment_type_code: "",
    deliver_to_location_id: "",
    deliver_to_party_name: "",
    deliver_to_address: "",
    delivery_date: "",
    ecommerce_scheme_id: "",
    buyer_legal_registration: "",
    buyer_registration_id: "",
    buyer_electronic_address: "",
    buyer_scheme_id: "",
    margin_credit_note_reason_code: "",
    margin_process_control: "",
    margin_preceding_ref: "",
    margin_preceding_date: "",
    contract_reference: "",
    contract_value: "",
    invoice_note: "",
    billing_frequency: "",
    invoicing_period_start: "",
    invoicing_period_end: "",
    principal_id: "",
    beneficiary_id: "",
  });

  // Pre-fill form from URL params (e.g. ?type=debit_note&preceding_invoice_id=xxx)
  useEffect(() => {
    const urlType = searchParams.get("type");
    const urlPrecedingId = searchParams.get("preceding_invoice_id");
    const updates = {};
    if (urlType === "debit_note") updates.invoice_type = "383";
    else if (urlType === "credit_note") updates.invoice_type = "381";
    if (urlPrecedingId) updates.preceding_invoice_id = urlPrecedingId;
    if (Object.keys(updates).length > 0) {
      setFormData((prev) => ({ ...prev, ...updates }));
    }
  }, []);

  // Fetch VAT settings on component mount and when window gains focus
  useEffect(() => {
    const fetchVatSettings = async () => {
      try {
        const response = await apiClient.get("/settings/vat");
        const vatStatus = response.data.vat_enabled || false;
        setVatEnabled(vatStatus);

        // Set default invoice type based on VAT status
        setFormData((prev) => ({
          ...prev,
          invoice_type: vatStatus ? "380" : "480",
          line_items: prev.line_items.map((item) =>
            normalizeLineItemForVat(item, vatStatus),
          ),
        }));
      } catch (error) {
        // Failed to fetch VAT settings, default to non-VAT mode
        setVatEnabled(false);
        // Default to Commercial Invoice (480) for non-VAT
        setFormData((prev) => ({
          ...prev,
          invoice_type: "480",
          line_items: prev.line_items.map((item) =>
            normalizeLineItemForVat(item, false),
          ),
        }));
      } finally {
        setLoadingVatSettings(false);
      }
    };

    fetchVatSettings();

    // Re-fetch VAT settings when window gains focus (e.g., after enabling VAT)
    const handleFocus = () => {
      fetchVatSettings();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  useEffect(() => {
    const fetchOriginalInvoices = async () => {
      const needsOriginalInvoice =
        formData.invoice_type === "381" ||
        formData.invoice_type === "81" ||
        formData.invoice_type === "383";
      if (!needsOriginalInvoice) {
        setOriginalInvoices([]);
        setFormData((prev) => ({ ...prev, preceding_invoice_id: "" }));
        return;
      }

      const originalType =
        formData.invoice_type === "381" || formData.invoice_type === "383"
          ? "380"
          : "480";
      setLoadingOriginalInvoices(true);
      try {
        const response = await apiClient.get(
          `/invoices?invoice_type=${originalType}`,
        );
        const list = Array.isArray(response.data) ? response.data : [];
        setOriginalInvoices(list.filter((inv) => inv.status !== "CANCELLED"));
        // initialize suggestions to first page of results
        setOriginalSuggestions((list || []).slice(0, 50));
      } catch (error) {
        setOriginalInvoices([]);
      } finally {
        setLoadingOriginalInvoices(false);
      }
    };

    fetchOriginalInvoices();
  }, [formData.invoice_type]);

  // Fetch suggestions from server when user types in the original invoice field
  useEffect(() => {
    const needsOriginalInvoice =
      formData.invoice_type === "381" ||
      formData.invoice_type === "81" ||
      formData.invoice_type === "383";
    if (!needsOriginalInvoice) return;

    // If no search query, show the pre-fetched original invoices (first page)
    if (!originalSearchQuery || originalSearchQuery.length < 1) {
      if (originalInvoices && originalInvoices.length > 0) {
        setOriginalSuggestions(originalInvoices.slice(0, 50));
        setShowOriginalSuggestions(true);
      } else {
        setOriginalSuggestions([]);
      }
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const originalType =
          formData.invoice_type === "381" || formData.invoice_type === "383"
            ? "380"
            : "480";
        const resp = await apiClient.get(
          `/invoices?invoice_type=${originalType}&q=${encodeURIComponent(originalSearchQuery)}&limit=10`,
          { signal: controller.signal },
        );
        const list = Array.isArray(resp.data) ? resp.data : [];
        setOriginalSuggestions(
          list.filter((inv) => inv.status !== "CANCELLED"),
        );
        setShowOriginalSuggestions(true);
        setOriginalHighlight(-1);
      } catch (err) {
        if (err.name !== "CanceledError" && err.name !== "AbortError") {
          console.error("Original invoice search failed", err);
        }
        setOriginalSuggestions([]);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [originalSearchQuery, formData.invoice_type]);

  // Auto-populate credit note data from selected original invoice
  useEffect(() => {
    const autoPopulateFromOriginalInvoice = async () => {
      if (!formData.preceding_invoice_id) {
        return;
      }

      try {
        const response = await apiClient.get(
          `/invoices/${formData.preceding_invoice_id}`,
        );
        const originalInvoice = response.data;

        // Populate customer details from original invoice
        setFormData((prev) => ({
          ...prev,
          customer_name: originalInvoice.customer_name,
          customer_email: originalInvoice.customer_email || "",
          customer_trn: originalInvoice.customer_trn || "",
          customer_address: originalInvoice.customer_address || "",
          customer_city: originalInvoice.customer_city || "",
          customer_country: originalInvoice.customer_country || "AE",
          currency_code: originalInvoice.currency_code, // Match original invoice currency
          // Copy line items from original invoice
          line_items: originalInvoice.line_items.map((item) => ({
            item_name: item.item_name,
            item_description: item.item_description || "",
            quantity: item.quantity, // Copy quantity from original invoice
            unit_price: item.unit_price,
            tax_category: item.tax_category,
            tax_percent: item.tax_percent,
            tax_code: item.tax_code || "SR",
          })),
        }));
      } catch (error) {
        console.error("Failed to load original invoice details:", error);
      }
    };

    autoPopulateFromOriginalInvoice();
  }, [formData.preceding_invoice_id]);

  const addLineItem = () => {
    setFormData({
      ...formData,
      line_items: [...formData.line_items, buildDefaultLineItem(vatEnabled)],
    });
  };

  const removeLineItem = (index) => {
    if (formData.line_items.length > 1) {
      setFormData({
        ...formData,
        line_items: formData.line_items.filter((_, i) => i !== index),
      });
    }
  };

  const updateLineItem = (index, field, value) => {
    const newItems = [...formData.line_items];
    const item = { ...newItems[index], [field]: value };

    // Smart tax calculation when tax_code changes
    if (field === "tax_code") {
      switch (value) {
        case "SR": // Standard Rate
          item.tax_category = "S";
          item.tax_percent = 5.0;
          break;
        case "ZR": // Zero Rated
          item.tax_category = "Z";
          item.tax_percent = 0;
          break;
        case "ES": // Exempt
          item.tax_category = "E";
          item.tax_percent = 0;
          break;
        case "RC": // Reverse Charge
          item.tax_category = "S";
          item.tax_percent = 0;
          break;
        case "OP": // Out of Scope
          item.tax_category = "O";
          item.tax_percent = 0;
          break;
      }
    }

    newItems[index] = item;
    setFormData({ ...formData, line_items: newItems });
  };

  const calculateTotal = () => {
    return formData.line_items.reduce((total, item) => {
      const subtotal = item.quantity * item.unit_price;
      const tax =
        vatEnabled && item.tax_category === "S"
          ? subtotal * (item.tax_percent / 100)
          : 0;
      return total + subtotal + tax;
    }, 0);
  };

  const calculateSubtotal = () => {
    return formData.line_items.reduce((total, item) => {
      return total + item.quantity * item.unit_price;
    }, 0);
  };

  const calculateTax = () => {
    return formData.line_items.reduce((total, item) => {
      const subtotal = item.quantity * item.unit_price;
      return (
        total +
        (vatEnabled && item.tax_category === "S"
          ? subtotal * (item.tax_percent / 100)
          : 0)
      );
    }, 0);
  };

  const isCreditNote =
    formData.invoice_type === "381" || formData.invoice_type === "81";
  const isDebitNote = formData.invoice_type === "383";
  const needsOriginalInvoice = isCreditNote || isDebitNote;
  const selectedOriginalInvoice = originalInvoices.find(
    (inv) => inv.id === formData.preceding_invoice_id,
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (needsOriginalInvoice) {
        if (!formData.preceding_invoice_id || !selectedOriginalInvoice) {
          setToast({
            message: isDebitNote
              ? "Please select the original tax invoice for this debit note."
              : "Please select the original invoice for this credit note.",
            type: "error",
            onClose: () => setToast(null),
          });
          setLoading(false);
          return;
        }

        if (!isDebitNote) {
          // Validate credit note type matches original invoice type
          const expectedCreditNoteType = getValidCreditNoteType(
            selectedOriginalInvoice.invoice_type,
          );

          if (formData.invoice_type !== expectedCreditNoteType) {
            const originalLabel = getDocumentTypeLabel(
              selectedOriginalInvoice.invoice_type,
            );
            const expectedLabel = getDocumentTypeLabel(expectedCreditNoteType);
            const currentLabel = getDocumentTypeLabel(formData.invoice_type);

            setToast({
              message: `${originalLabel} requires ${expectedLabel}, not ${currentLabel}. Please select the correct credit note type.`,
              type: "error",
              onClose: () => setToast(null),
            });
            setLoading(false);
            return;
          }

          // Validate credit note total doesn't exceed original invoice total
          const creditTotal = calculateTotal();
          const originalTotal = Number(
            selectedOriginalInvoice.total_amount || 0,
          );

          if (creditTotal > originalTotal) {
            setToast({
              message: `Credit note total (${formData.currency_code} ${creditTotal.toFixed(2)}) cannot exceed original invoice total (${selectedOriginalInvoice.currency_code} ${originalTotal.toFixed(2)}).`,
              type: "error",
              onClose: () => setToast(null),
            });
            setLoading(false);
            return;
          }
        }

        // Validate currency matches
        if (formData.currency_code !== selectedOriginalInvoice.currency_code) {
          setToast({
            message: `Currency must match the original invoice (${selectedOriginalInvoice.currency_code}).`,
            type: "error",
            onClose: () => setToast(null),
          });
          setLoading(false);
          return;
        }

        // Validate date is on or after original invoice date
        if (formData.issue_date < selectedOriginalInvoice.issue_date) {
          setToast({
            message: `Credit note date must be on or after the original invoice date (${selectedOriginalInvoice.issue_date}).`,
            type: "error",
            onClose: () => setToast(null),
          });
          setLoading(false);
          return;
        }
      }

      // Clean payload: Remove tax_code from line items when VAT is disabled
      // This ensures zero impact for non-VAT businesses
      const cleanedFormData = {
        ...formData,
        line_items: formData.line_items.map((item) => {
          if (!vatEnabled) {
            const { tax_code, ...itemWithoutTaxCode } = item;
            return {
              ...itemWithoutTaxCode,
              tax_category: "O",
              tax_percent: 0,
            };
          }
          return item;
        }),
      };

      const response = await apiClient.post("/invoices", cleanedFormData);
      const documentLabel = getDocumentTypeSuccessLabel(
        response.data.invoice_type ?? formData.invoice_type,
      );
      setToast({
        message: `${documentLabel} ${response.data.invoice_number} created successfully!`,
        type: "success",
        onClose: () => {
          setToast(null);
          navigate(`/invoices/${response.data.id}`);
        },
      });
    } catch (error) {
      const errorMessage =
        error.response?.data?.detail ||
        error.message ||
        "Failed to create invoice";
      setToast({
        message: `Error: ${errorMessage}`,
        type: "error",
        onClose: () => setToast(null),
      });
    } finally {
      setLoading(false);
    }
  };

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

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-indigo-50 rounded-xl">
              <FileText className="w-8 h-8 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Create {getDocumentTypeLabel(formData.invoice_type)}
              </h1>
              <p className="text-gray-600">
                {isCreditNote
                  ? "Adjust or return goods from a previous invoice"
                  : "UAE PINT-AE compliant e-invoice"}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Credit Note Information Banner */}
            {isCreditNote && (
              <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-amber-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-amber-800">
                      <strong>Credit Note Rules:</strong>
                    </p>
                    <ul className="text-xs text-amber-700 mt-2 list-disc list-inside space-y-1">
                      {selectedOriginalInvoice && (
                        <li>
                          This credit note must be type{" "}
                          <strong>
                            {getDocumentTypeLabel(
                              getValidCreditNoteType(
                                selectedOriginalInvoice.invoice_type,
                              ),
                            )}
                          </strong>{" "}
                          to match the original{" "}
                          <strong>
                            {getDocumentTypeLabel(
                              selectedOriginalInvoice.invoice_type,
                            )}
                          </strong>
                        </li>
                      )}
                      <li>Cannot exceed the original invoice total amount</li>
                      <li>
                        Must use the same currency as the original invoice
                      </li>
                      <li>
                        Date must be on or after the original invoice date
                      </li>
                      {vatEnabled &&
                        selectedOriginalInvoice?.invoice_type === "380" && (
                          <li>
                            Tax Credit Notes reduce BOTH principal and VAT
                            amounts
                          </li>
                        )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Debit Note Information Banner */}
            {isDebitNote && (
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-800">
                      <strong>Debit Note Rules (UBL 383):</strong>
                    </p>
                    <ul className="text-xs text-blue-700 mt-2 list-disc list-inside space-y-1">
                      <li>Must reference a posted Tax Invoice (380)</li>
                      <li>Increases the amount owed by the customer</li>
                      <li>
                        Use for additional charges, price adjustments, or
                        corrections
                      </li>
                      <li>
                        Date must be on or after the original invoice date
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* VAT Status Information */}
            {!vatEnabled && (
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-800">
                      <strong>Non-VAT-Registered Company:</strong> You can only
                      issue <strong>Commercial Invoices (480)</strong> and
                      standard <strong>Credit Notes (81)</strong>. To issue{" "}
                      <strong>Tax Invoices (380)</strong> or{" "}
                      <strong>Tax Credit Notes (381)</strong>, please enable VAT
                      in{" "}
                      <a
                        href="/settings/vat"
                        className="underline hover:text-blue-900"
                      >
                        VAT Settings
                      </a>{" "}
                      and upload your TRN certificate.
                    </p>
                    <p className="text-xs text-blue-700 mt-2">
                      ℹ️ As a non-VAT registered business, you cannot charge VAT
                      or issue VAT-compliant tax invoices until you obtain a Tax
                      Registration Number (TRN) from the UAE Federal Tax
                      Authority.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Invoice Details */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Invoice Details
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Invoice Type
                  </label>
                  <select
                    value={formData.invoice_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        invoice_type: e.target.value,
                        preceding_invoice_id: "",
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    {vatEnabled ? (
                      <>
                        <option value="380">
                          Tax Invoice (380) - VAT Taxable Supply
                        </option>
                        <option value="381">
                          Tax Credit Note (381) - VAT Adjustment
                        </option>
                        <option value="383">
                          Debit Note (383) - Additional Charge
                        </option>
                        <option value="480">
                          Commercial Invoice (480) - Export/Non-VAT
                        </option>
                      </>
                    ) : (
                      <>
                        <option value="480">
                          Commercial Invoice (480) - Standard Invoice
                        </option>
                        <option value="81">
                          Credit Note (81) - Returns/Adjustments
                        </option>
                      </>
                    )}
                  </select>
                  {!vatEnabled && (
                    <p className="mt-1 text-xs text-gray-500">
                      Tax invoices (380) not available - VAT registration
                      required
                    </p>
                  )}
                </div>

                {needsOriginalInvoice && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {isDebitNote
                        ? "Referenced Tax Invoice"
                        : "Original Invoice"}{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={
                          // show selected invoice number if selected, otherwise the search query
                          formData.preceding_invoice_id
                            ? originalInvoices.find(
                                (i) => i.id === formData.preceding_invoice_id,
                              )?.invoice_number || originalSearchQuery
                            : originalSearchQuery
                        }
                        onChange={(e) => {
                          setOriginalSearchQuery(e.target.value);
                          setFormData({
                            ...formData,
                            preceding_invoice_id: "",
                          });
                        }}
                        onFocus={() => {
                          if (originalSuggestions.length > 0)
                            setShowOriginalSuggestions(true);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setOriginalHighlight((h) =>
                              Math.min(h + 1, originalSuggestions.length - 1),
                            );
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setOriginalHighlight((h) => Math.max(h - 1, 0));
                          } else if (e.key === "Enter") {
                            if (
                              originalHighlight >= 0 &&
                              originalSuggestions[originalHighlight]
                            ) {
                              const sel =
                                originalSuggestions[originalHighlight];
                              setFormData({
                                ...formData,
                                preceding_invoice_id: sel.id,
                              });
                              setOriginalSearchQuery(sel.invoice_number);
                              setShowOriginalSuggestions(false);
                            }
                          } else if (e.key === "Escape") {
                            setShowOriginalSuggestions(false);
                          }
                        }}
                        placeholder={
                          loadingOriginalInvoices
                            ? "Loading invoices..."
                            : "Type invoice number or customer name"
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />

                      {showOriginalSuggestions &&
                        (originalSuggestions.length > 0 ? (
                          <ul className="absolute z-50 left-0 right-0 bg-white border border-gray-200 rounded-md mt-1 max-h-60 overflow-auto">
                            {originalSuggestions.map((inv, idx) => (
                              <li
                                key={inv.id}
                                onMouseDown={(e) => {
                                  // use onMouseDown to select before input blur
                                  e.preventDefault();
                                  setFormData({
                                    ...formData,
                                    preceding_invoice_id: inv.id,
                                  });
                                  setOriginalSearchQuery(inv.invoice_number);
                                  setShowOriginalSuggestions(false);
                                }}
                                onMouseEnter={() => setOriginalHighlight(idx)}
                                className={`px-3 py-2 cursor-pointer ${originalHighlight === idx ? "bg-indigo-50" : ""}`}
                              >
                                <div className="text-sm font-medium text-gray-900">
                                  {inv.invoice_number} — {inv.customer_name}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {inv.currency_code}{" "}
                                  {inv.total_amount.toFixed(2)} •{" "}
                                  {new Date(inv.issue_date).toLocaleDateString(
                                    "en-AE",
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : originalSearchQuery ? (
                          <div className="absolute z-50 left-0 right-0 bg-white border border-gray-200 rounded-md mt-1 p-3 text-sm text-gray-500">
                            No matches
                          </div>
                        ) : null)}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Currency
                  </label>
                  <input
                    type="text"
                    value={formData.currency_code}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        currency_code: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Issue Date
                  </label>
                  <input
                    type="date"
                    value={formData.issue_date}
                    onChange={(e) =>
                      setFormData({ ...formData, issue_date: e.target.value })
                    }
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />

                  {selectedOriginalInvoice && (
                    <div className="mt-2 p-3 bg-blue-50 rounded border border-blue-200">
                      {/* <p className="text-xs text-gray-600 mb-1">
                      <strong>Original Invoice:</strong> {selectedOriginalInvoice.invoice_number}
                    </p>
                    <p className="text-xs text-gray-600 mb-1">
                      <strong>Customer:</strong> {selectedOriginalInvoice.customer_name}
                    </p> */}
                      <p className="text-xs font-semibold text-blue-700">
                        Max Credit: {selectedOriginalInvoice.currency_code}{" "}
                        {selectedOriginalInvoice.total_amount.toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) =>
                      setFormData({ ...formData, due_date: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Delivery Date{" "}
                    <span className="text-xs text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={formData.delivery_date || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, delivery_date: e.target.value || "" })
                    }
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                      !formData.delivery_date && calculateTotal() >= 10000
                        ? "border-amber-400 bg-amber-50"
                        : "border-gray-300"
                    }`}
                  />
                  {!formData.delivery_date && calculateTotal() >= 10000 ? (
                    <p className="mt-1 text-xs text-amber-600 font-medium">
                      ⚠️ FTA requires delivery date on full tax invoices ≥ AED
                      10,000 when it differs from the issue date.
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-gray-400">
                      FTA UBL cac:Delivery/cbc:ActualDeliveryDate
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* UAE PINT-AE Transaction Type */}
            {vatEnabled && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-1">
                  UAE Transaction Scenario
                </h2>
                <p className="text-xs text-gray-500 mb-4">
                  Select the PEPPOL PINT-AE transaction scenario. Conditional fields will appear below.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Transaction Type
                    </label>
                    <select
                      value={formData.invoice_transaction_type}
                      onChange={(e) => setFormData({ ...formData, invoice_transaction_type: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="STANDARD">Standard (Default taxable supply)</option>
                      <option value="REVERSE_CHARGE">Reverse Charge (Buyer accounts for VAT)</option>
                      <option value="ZERO_RATED">Zero-Rated Supply</option>
                      <option value="EXEMPT">Exempt Supply</option>
                      <option value="DEEMED_SUPPLY">Deemed Supply (Goods/services used internally)</option>
                      <option value="ECOMMERCE">E-Commerce Supply</option>
                      <option value="EXPORT">Export of Goods/Services</option>
                      <option value="MARGIN_SCHEME">Margin Scheme (Second-hand goods)</option>
                      <option value="SUMMARY_INVOICE">Summary Invoice</option>
                      <option value="CONTINUOUS_SUPPLY">Continuous Supply</option>
                      <option value="SELF_BILLING">Self-Billing Invoice</option>
                      <option value="DISCLOSED_AGENT">Disclosed Agent Supply</option>
                      <option value="UNDISCLOSED_AGENT">Undisclosed Agent Supply</option>
                      <option value="FREE_TRADE_ZONE">Free Trade Zone Supply</option>
                      <option value="IMPORTS">Import of Goods</option>
                      <option value="DESIGNATED_ZONE">Designated Zone Supply</option>
                    </select>
                  </div>

                  {/* Reverse Charge / Zero-Rated / Exempt */}
                  {["REVERSE_CHARGE","ZERO_RATED","EXEMPT"].includes(formData.invoice_transaction_type) && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Exemption Reason Code</label>
                        <input type="text" value={formData.tax_exemption_reason_code}
                          onChange={(e) => setFormData({ ...formData, tax_exemption_reason_code: e.target.value })}
                          placeholder="e.g. VATEX-AE-RCES"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Exemption Reason</label>
                        <input type="text" value={formData.tax_exemption_reason}
                          onChange={(e) => setFormData({ ...formData, tax_exemption_reason: e.target.value })}
                          placeholder="Description of exemption"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    </>
                  )}

                  {/* Deemed Supply */}
                  {formData.invoice_transaction_type === "DEEMED_SUPPLY" && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Payment Due Date</label>
                        <input type="date" value={formData.payment_due_date}
                          onChange={(e) => setFormData({ ...formData, payment_due_date: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Payment Type Code</label>
                        <input type="text" value={formData.payment_type_code}
                          onChange={(e) => setFormData({ ...formData, payment_type_code: e.target.value })}
                          placeholder="e.g. 10 (cash)"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    </>
                  )}

                  {/* E-Commerce */}
                  {formData.invoice_transaction_type === "ECOMMERCE" && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Location ID</label>
                        <input type="text" value={formData.deliver_to_location_id}
                          onChange={(e) => setFormData({ ...formData, deliver_to_location_id: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Party Name</label>
                        <input type="text" value={formData.deliver_to_party_name}
                          onChange={(e) => setFormData({ ...formData, deliver_to_party_name: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Address</label>
                        <input type="text" value={formData.deliver_to_address}
                          onChange={(e) => setFormData({ ...formData, deliver_to_address: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">E-Commerce Scheme ID</label>
                        <input type="text" value={formData.ecommerce_scheme_id}
                          onChange={(e) => setFormData({ ...formData, ecommerce_scheme_id: e.target.value })}
                          placeholder="Marketplace/platform identifier"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    </>
                  )}

                  {/* Export */}
                  {formData.invoice_transaction_type === "EXPORT" && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Buyer Legal Registration</label>
                        <input type="text" value={formData.buyer_legal_registration}
                          onChange={(e) => setFormData({ ...formData, buyer_legal_registration: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Buyer Registration ID</label>
                        <input type="text" value={formData.buyer_registration_id}
                          onChange={(e) => setFormData({ ...formData, buyer_registration_id: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Buyer Electronic Address</label>
                        <input type="text" value={formData.buyer_electronic_address}
                          onChange={(e) => setFormData({ ...formData, buyer_electronic_address: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Buyer Scheme ID</label>
                        <input type="text" value={formData.buyer_scheme_id}
                          onChange={(e) => setFormData({ ...formData, buyer_scheme_id: e.target.value })}
                          placeholder="e.g. 0235"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    </>
                  )}

                  {/* Margin Scheme */}
                  {formData.invoice_transaction_type === "MARGIN_SCHEME" && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Credit Note Reason Code</label>
                        <input type="text" value={formData.margin_credit_note_reason_code}
                          onChange={(e) => setFormData({ ...formData, margin_credit_note_reason_code: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Process Control</label>
                        <input type="text" value={formData.margin_process_control}
                          onChange={(e) => setFormData({ ...formData, margin_process_control: e.target.value })}
                          placeholder="e.g. urn:peppol:pint:billing-1@ae-1:margin"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Preceding Invoice Ref</label>
                        <input type="text" value={formData.margin_preceding_ref}
                          onChange={(e) => setFormData({ ...formData, margin_preceding_ref: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Preceding Invoice Date</label>
                        <input type="date" value={formData.margin_preceding_date}
                          onChange={(e) => setFormData({ ...formData, margin_preceding_date: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    </>
                  )}

                  {/* Continuous Supply */}
                  {formData.invoice_transaction_type === "CONTINUOUS_SUPPLY" && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Contract Reference</label>
                        <input type="text" value={formData.contract_reference}
                          onChange={(e) => setFormData({ ...formData, contract_reference: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Contract Value (AED)</label>
                        <input type="number" value={formData.contract_value}
                          onChange={(e) => setFormData({ ...formData, contract_value: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Billing Frequency</label>
                        <select value={formData.billing_frequency}
                          onChange={(e) => setFormData({ ...formData, billing_frequency: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                          <option value="">Select frequency</option>
                          <option value="Monthly">Monthly</option>
                          <option value="Quarterly">Quarterly</option>
                          <option value="Annual">Annual</option>
                          <option value="Weekly">Weekly</option>
                        </select>
                      </div>
                    </>
                  )}

                  {/* Summary Invoice / Continuous Supply — invoicing period */}
                  {["SUMMARY_INVOICE","CONTINUOUS_SUPPLY"].includes(formData.invoice_transaction_type) && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Invoicing Period Start</label>
                        <input type="date" value={formData.invoicing_period_start}
                          onChange={(e) => setFormData({ ...formData, invoicing_period_start: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Invoicing Period End</label>
                        <input type="date" value={formData.invoicing_period_end}
                          onChange={(e) => setFormData({ ...formData, invoicing_period_end: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    </>
                  )}

                  {/* Disclosed Agent / Free Trade Zone / Self-Billing — principal */}
                  {["DISCLOSED_AGENT","FREE_TRADE_ZONE","SELF_BILLING"].includes(formData.invoice_transaction_type) && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Principal / Supplier ID</label>
                        <input type="text" value={formData.principal_id}
                          onChange={(e) => setFormData({ ...formData, principal_id: e.target.value })}
                          placeholder="TRN or PEPPOL ID of principal"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Beneficiary / Buyer ID</label>
                        <input type="text" value={formData.beneficiary_id}
                          onChange={(e) => setFormData({ ...formData, beneficiary_id: e.target.value })}
                          placeholder="TRN or PEPPOL ID of beneficiary"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Customer Details */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Customer Details
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    value={formData.customer_name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customer_name: e.target.value,
                      })
                    }
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Email
                  </label>
                  <EmailInput
                    value={formData.customer_email}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customer_email: e.target.value,
                      })
                    }
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer TRN{" "}
                    <span className="text-gray-400 text-xs">
                      (Optional - 15 digits)
                    </span>
                  </label>
                  <TRNInput
                    value={formData.customer_trn}
                    onChange={(e) =>
                      setFormData({ ...formData, customer_trn: e.target.value })
                    }
                    placeholder="100123456700003"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    value={formData.customer_city}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customer_city: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Country
                  </label>
                  <select
                    value={formData.customer_country}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customer_country: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="AE">🇦🇪 UAE</option>
                    <option value="SA">🇸🇦 Saudi Arabia</option>
                    <option value="BH">🇧🇭 Bahrain</option>
                    <option value="KW">🇰🇼 Kuwait</option>
                    <option value="OM">🇴🇲 Oman</option>
                    <option value="QA">🇶🇦 Qatar</option>
                    <option value="IN">🇮🇳 India</option>
                    <option value="PK">🇵🇰 Pakistan</option>
                    <option value="GB">🇬🇧 United Kingdom</option>
                    <option value="US">🇺🇸 United States</option>
                    <option value="DE">🇩🇪 Germany</option>
                    <option value="FR">🇫🇷 France</option>
                    <option value="CN">🇨🇳 China</option>
                    <option value="SG">🇸🇬 Singapore</option>
                    <option value="JP">🇯🇵 Japan</option>
                    <option value="TR">🇹🇷 Türkiye</option>
                    <option value="EG">🇪🇬 Egypt</option>
                    <option value="JO">🇯🇴 Jordan</option>
                    <option value="LB">🇱🇧 Lebanon</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address
                  </label>
                  <input
                    type="text"
                    value={formData.customer_address}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customer_address: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Line Items
                </h2>
                <button
                  type="button"
                  onClick={addLineItem}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
              </div>

              {/* VAT Info Banner */}
              {vatEnabled && (
                <div className="mb-4 bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-indigo-900">
                        VAT-Registered Business
                      </p>
                      <p className="text-sm text-indigo-700 mt-1">
                        You must select a UAE VAT tax code for each line item.
                        This ensures FTA compliance and accurate tax reporting.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {formData.line_items.map((item, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-700">
                      Item #{index + 1}
                    </span>
                    {formData.line_items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLineItem(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="Item name *"
                        value={item.item_name}
                        onChange={(e) =>
                          updateLineItem(index, "item_name", e.target.value)
                        }
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>

                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="Description (optional)"
                        value={item.item_description}
                        onChange={(e) =>
                          updateLineItem(
                            index,
                            "item_description",
                            e.target.value,
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>

                    <input
                      type="number"
                      placeholder="Quantity"
                      value={item.quantity}
                      onChange={(e) =>
                        updateLineItem(
                          index,
                          "quantity",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      step="0.01"
                      required
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    />

                    <input
                      type="number"
                      placeholder="Unit Price (AED)"
                      value={item.unit_price}
                      onChange={(e) =>
                        updateLineItem(
                          index,
                          "unit_price",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      step="0.01"
                      required
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    />

                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-indigo-700 mb-1">
                        UAE VAT Tax Code *
                      </label>
                      <select
                        value={item.tax_code || (vatEnabled ? "SR" : "OP")}
                        onChange={(e) =>
                          updateLineItem(index, "tax_code", e.target.value)
                        }
                        disabled={!vatEnabled}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-indigo-50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500 disabled:border-gray-300"
                        required
                      >
                        {vatEnabled && formData.invoice_type !== "480" ? (
                          <>
                            <option value="SR">SR - Standard Rate (5%)</option>
                            <option value="ZR">ZR - Zero Rated (0%)</option>
                            <option value="ES">ES - Exempt</option>
                            <option value="RC">RC - Reverse Charge</option>
                            <option value="OP">OP - Out of Scope</option>
                          </>
                        ) : vatEnabled && formData.invoice_type === "480" ? (
                          <>
                            <option value="ZR">ZR - Zero Rated (0%)</option>
                            <option value="ES">ES - Exempt</option>
                            <option value="RC">RC - Reverse Charge</option>
                            <option value="OP">OP - Out of Scope</option>
                          </>
                        ) : (
                          <>
                            <option value="OP">OP - Out of Scope</option>
                          </>
                        )}
                      </select>
                    </div>

                    <div className="text-right">
                      <span className="text-sm text-gray-600">
                        Line Total:{" "}
                      </span>
                      <span className="font-semibold">
                        AED{" "}
                        {(
                          item.quantity *
                          item.unit_price *
                          (1 +
                            (vatEnabled && item.tax_category === "S"
                              ? item.tax_percent / 100
                              : 0))
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="bg-indigo-50 rounded-xl p-6">
              <div className="space-y-2 text-right max-w-md ml-auto">
                <div className="flex justify-between text-gray-700">
                  <span>Subtotal:</span>
                  <span className="font-semibold">
                    AED {calculateSubtotal().toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>VAT:</span>
                  <span className="font-semibold">
                    AED {calculateTax().toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-2xl font-bold text-indigo-900 pt-2 border-t-2 border-indigo-200">
                  <span>Total:</span>
                  <span>AED {calculateTotal().toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Invoice Notes
              </label>
              <textarea
                value={formData.invoice_notes}
                onChange={(e) =>
                  setFormData({ ...formData, invoice_notes: e.target.value })
                }
                rows="3"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Additional notes or terms..."
              />
            </div>

            {/* Submit */}
            <div className="flex gap-4 justify-end">
              <button
                type="button"
                onClick={() => navigate("/invoices")}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                <Save className="w-5 h-5" />
                {loading ? "Creating..." : "Create Invoice"}
              </button>
            </div>
          </form>
        </div>
      </div>

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

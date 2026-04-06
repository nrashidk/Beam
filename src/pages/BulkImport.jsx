import { useEffect, useState } from "react";
import {
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import { bulkImportAPI, settingsAPI } from "../lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import Sidebar from "../components/Sidebar";

export default function BulkImport() {
  const [activeTab, setActiveTab] = useState("invoices");
  const [invoiceMode, setInvoiceMode] = useState("vat");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState("");
  const [vatEnabled, setVatEnabled] = useState(false);

  useEffect(() => {
    const fetchVatSettings = async () => {
      try {
        const response = await settingsAPI.getVATSettings();
        const enabled = response.data?.vat_enabled || false;
        setVatEnabled(enabled);
        setInvoiceMode(enabled ? "vat" : "non_vat");
      } catch (err) {
        setVatEnabled(false);
        setInvoiceMode("non_vat");
      }
    };

    fetchVatSettings();
  }, []);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const validTypes = [
        "text/csv",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];
      if (
        !validTypes.includes(file.type) &&
        !file.name.endsWith(".csv") &&
        !file.name.endsWith(".xlsx")
      ) {
        setError("Please upload a valid CSV or Excel file");
        return;
      }
      setSelectedFile(file);
      setError("");
      setUploadResult(null);
    }
  };

  const handleDownloadTemplate = async (type, format) => {
    try {
      const response =
        type === "invoices"
          ? await bulkImportAPI.downloadInvoiceTemplate(format, invoiceMode)
          : await bulkImportAPI.downloadVendorTemplate(format);

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `${type}_${type === "invoices" ? invoiceMode : "default"}_template.${format === "excel" ? "xlsx" : "csv"}`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to download template");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select a file to upload");
      return;
    }

    setUploading(true);
    setError("");
    setUploadResult(null);

    try {
      const response =
        activeTab === "invoices"
          ? await bulkImportAPI.uploadInvoices(selectedFile, invoiceMode)
          : await bulkImportAPI.uploadVendors(selectedFile);

      setUploadResult(response.data);
      if (response.data.success) {
        setSelectedFile(null);
        const fileInput = document.getElementById("file-upload");
        if (fileInput) fileInput.value = "";
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />

      <div className="flex-1 ml-64 flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <Upload className="h-6 w-6 text-indigo-600 flex-shrink-0" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Bulk Import</h1>
              <p className="text-sm text-gray-500 mt-0.5">Upload CSV or Excel files with separate flows for VAT and non-VAT invoice imports</p>
            </div>
          </div>
        </div>
        <div className="flex-1 p-6">
          <div className="max-w-5xl mx-auto">
            <div className="space-y-6">
              <div className="flex gap-2 border-b">
              <button
                onClick={() => {
                  setActiveTab("invoices");
                  setSelectedFile(null);
                  setUploadResult(null);
                  setError("");
                }}
                className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                  activeTab === "invoices"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                Import Invoices
              </button>
              {/* <button
                onClick={() => {
                  setActiveTab("vendors");
                  setSelectedFile(null);
                  setUploadResult(null);
                  setError("");
                }}
                className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                  activeTab === "vendors"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                Import Vendors
              </button> */}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  Step 1: Download Template
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeTab === "invoices" && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      onClick={() => {
                        setInvoiceMode("vat");
                        setSelectedFile(null);
                        setUploadResult(null);
                        setError("");
                      }}
                      className={`rounded-lg border p-4 text-left transition-colors ${
                        invoiceMode === "vat"
                          ? "border-indigo-600 bg-indigo-50"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-900">
                        VAT-Enabled Bulk Upload
                      </p>
                      <p className="mt-1 text-xs text-gray-600">
                        Use for Tax Invoice, Tax Credit Note, Debit Note, and
                        Commercial Invoice.
                      </p>
                    </button>
                    <button
                      onClick={() => {
                        setInvoiceMode("non_vat");
                        setSelectedFile(null);
                        setUploadResult(null);
                        setError("");
                      }}
                      className={`rounded-lg border p-4 text-left transition-colors ${
                        invoiceMode === "non_vat"
                          ? "border-indigo-600 bg-indigo-50"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-900">
                        Non-VAT Bulk Upload
                      </p>
                      <p className="mt-1 text-xs text-gray-600">
                        Use for Commercial Invoice and non-VAT Credit Note only.
                      </p>
                    </button>
                  </div>
                )}
                <p className="text-sm text-gray-600">
                  Download a pre-formatted template to ensure your data is
                  structured correctly
                </p>
                {activeTab === "invoices" && (
                  <div
                    className={`rounded-lg border px-4 py-3 text-sm ${
                      invoiceMode === "vat"
                        ? vatEnabled
                          ? "border-green-200 bg-green-50 text-green-800"
                          : "border-amber-200 bg-amber-50 text-amber-800"
                        : !vatEnabled
                          ? "border-green-200 bg-green-50 text-green-800"
                          : "border-amber-200 bg-amber-50 text-amber-800"
                    }`}
                  >
                    {invoiceMode === "vat"
                      ? vatEnabled
                        ? "Your company is VAT-enabled. This template keeps VAT calculations active for tax documents and keeps commercial invoices out of scope."
                        : "VAT bulk upload requires VAT to be enabled in Settings first."
                      : !vatEnabled
                        ? "Your company is non-VAT. This template forces all uploaded rows to zero tax."
                        : "Non-VAT bulk upload is only for non-VAT companies. VAT-enabled companies should use the VAT template."}
                  </div>
                )}
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleDownloadTemplate(activeTab, "csv")}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Download CSV Template
                  </Button>
                  <Button
                    onClick={() => handleDownloadTemplate(activeTab, "excel")}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Download Excel Template
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Step 2: Upload File
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-400 transition-colors">
                  <input
                    id="file-upload"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-sm font-medium text-gray-700">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      CSV or Excel files only
                    </p>
                  </label>
                </div>

                {selectedFile && (
                  <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {selectedFile.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(selectedFile.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        const fileInput =
                          document.getElementById("file-upload");
                        if (fileInput) fileInput.value = "";
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                  className="w-full"
                >
                  {uploading
                    ? "Uploading..."
                    : `Upload ${activeTab === "invoices" ? "Invoices" : "Vendors"}`}
                </Button>
              </CardContent>
            </Card>

            {uploadResult && (
              <Card
                className={
                  uploadResult.success
                    ? "border-green-200 bg-green-50"
                    : "border-red-200 bg-red-50"
                }
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {uploadResult.success ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <span className="text-green-900">
                          Upload Successful
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-5 h-5 text-red-600" />
                        <span className="text-red-900">Upload Failed</span>
                      </>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-3 rounded-lg border">
                      <p className="text-xs text-gray-600">Total Rows</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {uploadResult.total_rows || 0}
                      </p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border">
                      <p className="text-xs text-gray-600">Valid Rows</p>
                      <p className="text-2xl font-bold text-green-600">
                        {uploadResult.valid_rows || 0}
                      </p>
                    </div>
                    {uploadResult.created !== undefined && (
                      <div className="bg-white p-3 rounded-lg border">
                        <p className="text-xs text-gray-600">Created</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {uploadResult.created}
                        </p>
                      </div>
                    )}
                    {uploadResult.updated !== undefined && (
                      <div className="bg-white p-3 rounded-lg border">
                        <p className="text-xs text-gray-600">Updated</p>
                        <p className="text-2xl font-bold text-indigo-600">
                          {uploadResult.updated}
                        </p>
                      </div>
                    )}
                  </div>

                  {uploadResult.message && (
                    <p
                      className={`text-sm font-medium ${uploadResult.success ? "text-green-800" : "text-red-800"}`}
                    >
                      {uploadResult.message}
                    </p>
                  )}

                  {uploadResult.errors && uploadResult.errors.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-red-900">
                        Errors Found:
                      </p>
                      <div className="bg-white border border-red-200 rounded-lg p-4 max-h-60 overflow-y-auto">
                        <ul className="space-y-1">
                          {uploadResult.errors.map((error, idx) => (
                            <li
                              key={idx}
                              className="text-sm text-red-700 flex items-start gap-2"
                            >
                              <span className="text-red-400">•</span>
                              <span>{error}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-900 flex items-center gap-2">
                  Tips for Successful Import
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    activeTab === "invoices" && invoiceMode === "vat"
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    {activeTab === "invoices"
                      ? invoiceMode === "vat" ? "VAT Template" : "Non-VAT Template"
                      : "Vendor Template"}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-blue-800">
                  {/* Shared tip 1 */}
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>
                      Download the template first to see the required column
                      format and column order before filling in your data
                    </span>
                  </li>

                  {/* VAT-specific tips */}
                  {activeTab === "invoices" && invoiceMode === "vat" && (
                    <>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 mt-1">•</span>
                        <span>
                          Supported invoice types: <strong>TAX_INVOICE</strong>, <strong>TAX_CREDIT_NOTE</strong>, <strong>DEBIT_NOTE</strong>, and <strong>COMMERCIAL</strong>
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 mt-1">•</span>
                        <span>
                          Your supplier TRN (15 digits) must be configured in your company settings before uploading — it is embedded in every generated tax invoice
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 mt-1">•</span>
                        <span>
                          Customer TRN is required for full Tax Invoices (total ≥ AED 10,000) — invoices without a customer TRN at that value will be rejected
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 mt-1">•</span>
                        <span>
                          Credit notes (TAX_CREDIT_NOTE) must include a valid <strong>preceding_invoice_number</strong> referencing the original invoice being reversed
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 mt-1">•</span>
                        <span>
                          Tax is calculated automatically from your line-item amounts — the <strong>tax_code</strong> column accepts: <strong>SR</strong> (Standard Rate, 5%), <strong>ZR</strong> (Zero-Rated, 0%), <strong>ES</strong> (Exempt, no VAT), or <strong>OP</strong> (Out-of-Scope, no VAT)
                        </span>
                      </li>
                    </>
                  )}

                  {/* Non-VAT-specific tips */}
                  {activeTab === "invoices" && invoiceMode === "non_vat" && (
                    <>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 mt-1">•</span>
                        <span>
                          Supported invoice types for this template: <strong>COMMERCIAL</strong> and <strong>CREDIT_NOTE</strong> only — tax invoice types are not available for non-VAT companies
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 mt-1">•</span>
                        <span>
                          All tax amounts are automatically forced to 0 during upload — any tax values in your file will be ignored
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 mt-1">•</span>
                        <span>
                          TRN columns are not required and will be ignored — do not include a TRN in the customer or supplier fields
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 mt-1">•</span>
                        <span>
                          If your company becomes VAT-registered in the future, switch to the VAT-Enabled template and re-upload — do not mix templates
                        </span>
                      </li>
                    </>
                  )}

                  {/* Shared tip 2 */}
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>
                      Dates should be in <strong>YYYY-MM-DD</strong> format (e.g., 2025-01-15) for issue date, due date, and supply date columns
                    </span>
                  </li>

                  {/* Shared tip 3 */}
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>
                      Free and trial users can bulk import up to 10 invoices
                      total. Upgrade to a paid plan for unlimited bulk imports.
                    </span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}

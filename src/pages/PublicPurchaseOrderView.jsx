import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FileText, Calendar, Building2 } from "lucide-react";
import { apiClient } from "../lib/api";
import PageLoader from "../components/PageLoader";

export default function PublicPurchaseOrderView() {
  const { poId } = useParams();
  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchPO = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get(`/api/public/purchase-orders/${poId}`);
        setPo(response.data);
      } catch (err) {
        setError(err.response?.data?.detail || "Purchase order not found");
      } finally {
        setLoading(false);
      }
    };

    fetchPO();
  }, [poId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <PageLoader />
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white shadow rounded-xl p-8 max-w-md w-full text-center">
          <FileText className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Purchase Order Not Found</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto bg-white shadow rounded-2xl overflow-hidden">
        <div className="bg-indigo-600 text-white p-6">
          <h1 className="text-2xl font-bold">Purchase Order {po.po_number}</h1>
          <p className="text-indigo-100 mt-1">Status: {po.status}</p>
        </div>

        <div className="p-6 grid md:grid-cols-2 gap-6 border-b">
          <div>
            <h2 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Supplier
            </h2>
            <p className="text-gray-800">{po.supplier_name || "-"}</p>
            {po.supplier_address ? <p className="text-gray-600 mt-1">{po.supplier_address}</p> : null}
            {po.supplier_trn ? <p className="text-gray-600 mt-1">TRN: {po.supplier_trn}</p> : null}
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Dates
            </h2>
            <p className="text-gray-700">Order Date: {po.order_date || "-"}</p>
            <p className="text-gray-700 mt-1">Expected Delivery: {po.expected_delivery_date || "-"}</p>
            {po.reference_number ? <p className="text-gray-700 mt-1">Reference: {po.reference_number}</p> : null}
          </div>
        </div>

        <div className="p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Line Items</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-600">
                  <th className="py-2 pr-2">Item</th>
                  <th className="py-2 pr-2 text-right">Qty</th>
                  <th className="py-2 pr-2 text-right">Unit Price</th>
                  <th className="py-2 pr-2 text-right">Tax %</th>
                  <th className="py-2 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {(po.line_items || []).map((item) => (
                  <tr key={item.id} className="border-b last:border-b-0">
                    <td className="py-3 pr-2">
                      <div className="font-medium text-gray-900">{item.item_name}</div>
                      {item.item_description ? (
                        <div className="text-gray-500 text-xs mt-1">{item.item_description}</div>
                      ) : null}
                    </td>
                    <td className="py-3 pr-2 text-right">{item.quantity_ordered}</td>
                    <td className="py-3 pr-2 text-right">{po.currency_code} {Number(item.unit_price || 0).toFixed(2)}</td>
                    <td className="py-3 pr-2 text-right">{Number(item.tax_percent || 0).toFixed(2)}</td>
                    <td className="py-3 text-right font-medium">{po.currency_code} {Number(item.line_total || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-6 bg-gray-50 border-t">
          <div className="max-w-sm ml-auto space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span>{po.currency_code} {Number(po.expected_subtotal || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Tax</span>
              <span>{po.currency_code} {Number(po.expected_tax || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold text-base pt-2 border-t">
              <span>Total</span>
              <span>{po.currency_code} {Number(po.expected_total || 0).toFixed(2)}</span>
            </div>
          </div>
          {po.notes ? <p className="mt-4 text-sm text-gray-600">Notes: {po.notes}</p> : null}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { useInvoicingStore, useSelectedInvoice } from '../../stores/invoicing';
import { useCrmStore } from '../../stores/crm';
import { useInvoicing } from '../../hooks/useInvoicing';
import { INVOICE_STATUS_CONFIG } from '../../types/invoicing';
import type { InvoiceStatus, InvoiceLineItem, InvoicePayment } from '../../types/invoicing';
import { PaymentLinkButton } from '../payments/PaymentLinkButton';
import { DocumentSection } from '../documents/DocumentSection';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function statusBadgeClasses(color: string): string {
  const map: Record<string, string> = {
    zinc: 'bg-zinc-500/20 text-zinc-400',
    blue: 'bg-blue-500/20 text-blue-400',
    cyan: 'bg-cyan-500/20 text-cyan-400',
    green: 'bg-green-500/20 text-green-400',
    red: 'bg-red-500/20 text-red-400',
    amber: 'bg-amber-500/20 text-amber-400',
    purple: 'bg-purple-500/20 text-purple-400',
  };
  return map[color] || map.zinc;
}

// ─── Component ──────────────────────────────────────────────────────────────

interface InvoiceDetailProps {
  onEdit: (invoiceId: string) => void;
}

export function InvoiceDetail({ onEdit }: InvoiceDetailProps) {
  const invoice = useSelectedInvoice();
  const selectInvoice = useInvoicingStore((s) => s.selectInvoice);
  const contacts = useCrmStore((s) => s.contacts);
  const companies = useCrmStore((s) => s.companies);
  const openProfileWorkspace = useCrmStore((s) => s.openProfileWorkspace);
  const {
    updateInvoiceStatus,
    deleteInvoice,
    fetchInvoiceLineItems,
    fetchInvoicePayments,
    recordPayment,
  } = useInvoicing();

  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  useEffect(() => {
    if (invoice) {
      fetchInvoiceLineItems(invoice.id).then(setLineItems);
      fetchInvoicePayments(invoice.id).then(setPayments);
      setConfirmDelete(false);
      setShowPaymentForm(false);
    }
  }, [invoice?.id, fetchInvoiceLineItems, fetchInvoicePayments]);

  const contact = useMemo(
    () => (invoice?.contact_id ? contacts.find((c) => c.id === invoice.contact_id) : null),
    [contacts, invoice?.contact_id]
  );

  const company = useMemo(
    () => (invoice?.company_id ? companies.find((c) => c.id === invoice.company_id) : null),
    [companies, invoice?.company_id]
  );

  if (!invoice) return null;

  const statusConfig = INVOICE_STATUS_CONFIG[invoice.status];

  const handleStatusChange = (status: InvoiceStatus) => {
    updateInvoiceStatus(invoice.id, status);
  };

  const handleRecordPayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) return;
    setPaymentSubmitting(true);
    const payment = await recordPayment(
      invoice.id,
      amount,
      paymentMethod || undefined,
      paymentRef || undefined
    );
    if (payment) {
      setPayments((prev) => [payment, ...prev]);
    }
    setPaymentAmount('');
    setPaymentMethod('');
    setPaymentRef('');
    setShowPaymentForm(false);
    setPaymentSubmitting(false);
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await deleteInvoice(invoice.id);
    selectInvoice(null);
  };

  return (
    <div className="w-80 border-l border-zinc-800 bg-zinc-900/50 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-400">Invoice Details</h2>
        <button
          onClick={() => selectInvoice(null)}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Header Info */}
        <div className="text-center">
          <h3 className="text-lg font-medium text-zinc-100">{invoice.invoice_number}</h3>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            {formatCurrency(invoice.total, invoice.currency)}
          </div>
          <span
            className={`inline-block mt-2 px-3 py-0.5 text-xs rounded-full ${statusBadgeClasses(statusConfig.color)}`}
          >
            {statusConfig.label}
          </span>
          <button
            onClick={() => openProfileWorkspace('invoice', invoice.id, invoice.invoice_number)}
            className="mt-2 w-full px-3 py-1.5 text-xs bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors text-center"
          >
            Open Full Profile
          </button>
        </div>

        {/* Amount Summary */}
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Total</span>
            <span className="text-zinc-300">{formatCurrency(invoice.total, invoice.currency)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Paid</span>
            <span className="text-green-400">{formatCurrency(invoice.amount_paid, invoice.currency)}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold border-t border-zinc-700 pt-1">
            <span className="text-zinc-300">Balance Due</span>
            <span className={invoice.amount_due > 0 ? 'text-red-400' : 'text-green-400'}>
              {formatCurrency(invoice.amount_due, invoice.currency)}
            </span>
          </div>
        </div>

        {/* Contact & Company */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Contact & Company
          </h4>
          {contact ? (
            <div className="text-sm text-zinc-300">
              {contact.first_name} {contact.last_name}
              {contact.email && (
                <span className="text-zinc-500 block text-xs">{contact.email}</span>
              )}
            </div>
          ) : (
            <p className="text-xs text-zinc-600">No contact linked</p>
          )}
          {company && (
            <div className="text-sm text-zinc-400 mt-1">{company.name}</div>
          )}
        </div>

        {/* Dates */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Dates
          </h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Issued</span>
              <span className="text-zinc-300">{new Date(invoice.issue_date).toLocaleDateString()}</span>
            </div>
            {invoice.due_date && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Due</span>
                <span className={
                  new Date(invoice.due_date) < new Date() && invoice.status !== 'paid'
                    ? 'text-red-400'
                    : 'text-zinc-300'
                }>
                  {new Date(invoice.due_date).toLocaleDateString()}
                </span>
              </div>
            )}
            {invoice.paid_at && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Paid</span>
                <span className="text-green-400">{new Date(invoice.paid_at).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Line Items */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Line Items ({lineItems.length})
          </h4>
          {lineItems.length === 0 ? (
            <p className="text-xs text-zinc-600">No line items</p>
          ) : (
            <div className="space-y-1.5">
              {lineItems.map((li) => (
                <div
                  key={li.id}
                  className="flex items-start gap-2 bg-zinc-800/30 border border-zinc-800 rounded p-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-zinc-300 truncate">{li.name}</div>
                    <div className="text-[10px] text-zinc-600">
                      {li.quantity} x {formatCurrency(li.unit_price, invoice.currency)}
                      {li.discount_percent > 0 && ` (-${li.discount_percent}%)`}
                    </div>
                  </div>
                  <span className="text-xs text-amber-400 shrink-0">
                    {formatCurrency(li.subtotal, invoice.currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payments */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Payments ({payments.length})
          </h4>
          {payments.length === 0 ? (
            <p className="text-xs text-zinc-600">No payments recorded</p>
          ) : (
            <div className="space-y-1.5">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 bg-zinc-800/30 border border-zinc-800 rounded p-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-zinc-300">
                      {formatCurrency(p.amount, invoice.currency)}
                    </div>
                    <div className="text-[10px] text-zinc-600">
                      {p.payment_method || 'Unknown method'}
                      {p.reference_number && ` - ${p.reference_number}`}
                      {' -- '}
                      {new Date(p.paid_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Attachments */}
        <DocumentSection entityType="invoice" entityId={invoice.id} title="Attachments" />

        {/* PayPal Payment Link */}
        {invoice.status !== 'paid' && invoice.status !== 'void' && (
          <PaymentLinkButton
            invoiceId={invoice.id}
            invoiceAmountDue={invoice.amount_due}
          />
        )}

        {/* Payment Form */}
        {showPaymentForm && (
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 space-y-2">
            <h4 className="text-xs font-semibold text-zinc-400">Record Payment</h4>
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="Amount"
              min="0"
              step="0.01"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
              autoFocus
            />
            <input
              type="text"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              placeholder="Payment method (e.g. Bank Transfer)"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
            />
            <input
              type="text"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              placeholder="Reference number"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowPaymentForm(false)}
                className="flex-1 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRecordPayment}
                disabled={!paymentAmount || paymentSubmitting}
                className="flex-1 px-3 py-1.5 text-xs bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 disabled:opacity-50 transition-colors"
              >
                {paymentSubmitting ? 'Saving...' : 'Record'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Actions Footer */}
      <div className="border-t border-zinc-800 p-3 space-y-2">
        <button
          onClick={() => onEdit(invoice.id)}
          className="w-full px-3 py-2 text-xs bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors"
        >
          Edit Invoice
        </button>

        {invoice.status !== 'paid' && invoice.status !== 'void' && (
          <button
            onClick={() => setShowPaymentForm(true)}
            className="w-full px-3 py-2 text-xs bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
          >
            Record Payment
          </button>
        )}

        {invoice.status === 'draft' && (
          <button
            onClick={() => handleStatusChange('sent')}
            className="w-full px-3 py-2 text-xs bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
          >
            Mark as Sent
          </button>
        )}

        {invoice.status !== 'void' && invoice.status !== 'paid' && (
          <button
            onClick={() => handleStatusChange('void')}
            className="w-full px-3 py-2 text-xs bg-zinc-500/20 text-zinc-400 rounded-lg hover:bg-zinc-500/30 transition-colors"
          >
            Void Invoice
          </button>
        )}

        <button
          onClick={handleDelete}
          className={`w-full px-3 py-2 text-xs rounded-lg transition-colors ${
            confirmDelete
              ? 'bg-red-500/30 text-red-300 border border-red-500/50'
              : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
          }`}
        >
          {confirmDelete ? 'Click again to confirm delete' : 'Delete Invoice'}
        </button>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useInvoicingStore } from '../../stores/invoicing';
import { useInvoicing } from '../../hooks/useInvoicing';
import { QuoteList } from './QuoteList';
import { InvoiceList } from './InvoiceList';
import { QuoteEditor } from './QuoteEditor';
import { InvoiceEditor } from './InvoiceEditor';

interface InvoicingTabProps {
  initialSubTab?: 'quotes' | 'invoices';
}

export function InvoicingTab({ initialSubTab }: InvoicingTabProps) {
  // Initialize data fetching + realtime subscriptions
  useInvoicing();

  const activeSubTab = useInvoicingStore((s) => s.activeSubTab);
  const setActiveSubTab = useInvoicingStore((s) => s.setActiveSubTab);

  // Sync with parent CRM sub-tab selection
  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab, setActiveSubTab]);

  // Editor modals
  const [showQuoteEditor, setShowQuoteEditor] = useState(false);
  const [editQuoteId, setEditQuoteId] = useState<string | null>(null);
  const [showInvoiceEditor, setShowInvoiceEditor] = useState(false);
  const [editInvoiceId, setEditInvoiceId] = useState<string | null>(null);

  const handleCreateQuote = () => {
    setEditQuoteId(null);
    setShowQuoteEditor(true);
  };

  const handleCreateInvoice = () => {
    setEditInvoiceId(null);
    setShowInvoiceEditor(true);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Content -- no sub-nav since we're embedded in CRM sub-tabs */}
      <div className="flex-1 overflow-hidden">
        {activeSubTab === 'quotes' && (
          <QuoteList onCreateQuote={handleCreateQuote} />
        )}
        {activeSubTab === 'invoices' && (
          <InvoiceList onCreateInvoice={handleCreateInvoice} />
        )}
      </div>

      {/* Quote Editor Modal */}
      {showQuoteEditor && (
        <QuoteEditor
          quoteId={editQuoteId}
          onClose={() => {
            setShowQuoteEditor(false);
            setEditQuoteId(null);
          }}
        />
      )}

      {/* Invoice Editor Modal */}
      {showInvoiceEditor && (
        <InvoiceEditor
          invoiceId={editInvoiceId}
          onClose={() => {
            setShowInvoiceEditor(false);
            setEditInvoiceId(null);
          }}
        />
      )}
    </div>
  );
}

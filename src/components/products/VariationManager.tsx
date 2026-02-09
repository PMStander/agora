import { useState } from 'react';
import { useVariationsForProduct } from '../../stores/products';
import { useProducts } from '../../hooks/useProducts';
import { STOCK_STATUS_CONFIG } from '../../types/products';

// ─── Helpers ────────────────────────────────────────────────────────────────

const stockBadgeColors: Record<string, string> = {
  green: 'bg-emerald-500/20 text-emerald-300',
  red: 'bg-red-500/20 text-red-300',
  amber: 'bg-amber-500/20 text-amber-300',
};

// ─── Component ──────────────────────────────────────────────────────────────

interface VariationManagerProps {
  productId: string;
}

interface EditState {
  [variationId: string]: {
    sku?: string;
    regular_price?: string;
    sale_price?: string;
    stock_quantity?: string;
  };
}

export function VariationManager({ productId }: VariationManagerProps) {
  const variations = useVariationsForProduct(productId);
  const { createVariation, updateVariationDetails, deleteVariation } = useProducts();

  const [editState, setEditState] = useState<EditState>({});
  const [isAdding, setIsAdding] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Collect all attribute keys from existing variations
  const attributeKeys = Array.from(
    new Set(variations.flatMap((v) => Object.keys(v.attributes || {})))
  ).sort();

  const handleFieldChange = (
    variationId: string,
    field: keyof EditState[string],
    value: string
  ) => {
    setEditState((prev) => ({
      ...prev,
      [variationId]: {
        ...prev[variationId],
        [field]: value,
      },
    }));
  };

  const handleSaveField = async (variationId: string, field: string) => {
    const edits = editState[variationId];
    if (!edits) return;

    const value = edits[field as keyof typeof edits];
    if (value === undefined) return;

    const updates: Record<string, unknown> = {};
    if (field === 'sku') {
      updates.sku = value || null;
    } else if (field === 'regular_price' || field === 'sale_price') {
      const num = parseFloat(value);
      updates[field] = isNaN(num) ? null : num;
    } else if (field === 'stock_quantity') {
      const num = parseInt(value, 10);
      updates[field] = isNaN(num) ? null : num;
    }

    await updateVariationDetails(variationId, updates);

    // Clear edit state for this field
    setEditState((prev) => {
      const newEdits = { ...prev[variationId] };
      delete newEdits[field as keyof typeof newEdits];
      if (Object.keys(newEdits).length === 0) {
        const { [variationId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [variationId]: newEdits };
    });
  };

  const handleAddVariation = async () => {
    setIsAdding(true);
    await createVariation({ product_id: productId });
    setIsAdding(false);
  };

  const handleDeleteVariation = async (variationId: string) => {
    if (confirmDeleteId !== variationId) {
      setConfirmDeleteId(variationId);
      return;
    }
    await deleteVariation(variationId);
    setConfirmDeleteId(null);
  };

  if (variations.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-zinc-600">No variations defined</p>
        <button
          onClick={handleAddVariation}
          disabled={isAdding}
          className="px-3 py-1.5 text-xs bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 disabled:opacity-50 transition-colors"
        >
          {isAdding ? 'Adding...' : 'Add Variation'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800">
              {attributeKeys.map((key) => (
                <th
                  key={key}
                  className="text-left py-1.5 px-1 text-zinc-500 font-medium capitalize"
                >
                  {key}
                </th>
              ))}
              <th className="text-left py-1.5 px-1 text-zinc-500 font-medium">SKU</th>
              <th className="text-left py-1.5 px-1 text-zinc-500 font-medium">Price</th>
              <th className="text-left py-1.5 px-1 text-zinc-500 font-medium">Sale</th>
              <th className="text-left py-1.5 px-1 text-zinc-500 font-medium">Qty</th>
              <th className="text-left py-1.5 px-1 text-zinc-500 font-medium">Stock</th>
              <th className="text-left py-1.5 px-1 text-zinc-500 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {variations.map((variation) => {
              const stockConfig = STOCK_STATUS_CONFIG[variation.stock_status];
              const edits = editState[variation.id] || {};

              return (
                <tr
                  key={variation.id}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                >
                  {/* Attribute columns */}
                  {attributeKeys.map((key) => (
                    <td key={key} className="py-1.5 px-1 text-zinc-300">
                      {variation.attributes?.[key] ?? '--'}
                    </td>
                  ))}

                  {/* SKU (editable) */}
                  <td className="py-1.5 px-1">
                    <input
                      type="text"
                      value={
                        edits.sku !== undefined
                          ? edits.sku
                          : variation.sku ?? ''
                      }
                      onChange={(e) =>
                        handleFieldChange(variation.id, 'sku', e.target.value)
                      }
                      onBlur={() => handleSaveField(variation.id, 'sku')}
                      className="w-16 bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-200 text-xs focus:border-amber-500/50 focus:outline-none"
                    />
                  </td>

                  {/* Regular Price (editable) */}
                  <td className="py-1.5 px-1">
                    <input
                      type="text"
                      value={
                        edits.regular_price !== undefined
                          ? edits.regular_price
                          : variation.regular_price?.toString() ?? ''
                      }
                      onChange={(e) =>
                        handleFieldChange(
                          variation.id,
                          'regular_price',
                          e.target.value
                        )
                      }
                      onBlur={() =>
                        handleSaveField(variation.id, 'regular_price')
                      }
                      className="w-16 bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-200 text-xs focus:border-amber-500/50 focus:outline-none"
                    />
                  </td>

                  {/* Sale Price (editable) */}
                  <td className="py-1.5 px-1">
                    <input
                      type="text"
                      value={
                        edits.sale_price !== undefined
                          ? edits.sale_price
                          : variation.sale_price?.toString() ?? ''
                      }
                      onChange={(e) =>
                        handleFieldChange(
                          variation.id,
                          'sale_price',
                          e.target.value
                        )
                      }
                      onBlur={() =>
                        handleSaveField(variation.id, 'sale_price')
                      }
                      className="w-16 bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-200 text-xs focus:border-amber-500/50 focus:outline-none"
                    />
                  </td>

                  {/* Stock Quantity (editable) */}
                  <td className="py-1.5 px-1">
                    <input
                      type="text"
                      value={
                        edits.stock_quantity !== undefined
                          ? edits.stock_quantity
                          : variation.stock_quantity?.toString() ?? ''
                      }
                      onChange={(e) =>
                        handleFieldChange(
                          variation.id,
                          'stock_quantity',
                          e.target.value
                        )
                      }
                      onBlur={() =>
                        handleSaveField(variation.id, 'stock_quantity')
                      }
                      className="w-12 bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-200 text-xs focus:border-amber-500/50 focus:outline-none"
                    />
                  </td>

                  {/* Stock Status */}
                  <td className="py-1.5 px-1">
                    <span
                      className={`text-[10px] px-1 py-0.5 rounded ${
                        stockBadgeColors[stockConfig.color] ??
                        stockBadgeColors.green
                      }`}
                    >
                      {stockConfig.label}
                    </span>
                  </td>

                  {/* Delete */}
                  <td className="py-1.5 px-1">
                    <button
                      onClick={() => handleDeleteVariation(variation.id)}
                      className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
                        confirmDeleteId === variation.id
                          ? 'bg-red-500/30 text-red-300'
                          : 'text-zinc-600 hover:text-red-400'
                      }`}
                      title={
                        confirmDeleteId === variation.id
                          ? 'Click again to confirm'
                          : 'Delete variation'
                      }
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        onClick={handleAddVariation}
        disabled={isAdding}
        className="px-3 py-1.5 text-xs bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 disabled:opacity-50 transition-colors"
      >
        {isAdding ? 'Adding...' : 'Add Variation'}
      </button>
    </div>
  );
}

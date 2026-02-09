import { useState } from 'react';
import { useProductsStore, useCategoryTree } from '../../stores/products';
import { useProducts } from '../../hooks/useProducts';
import type { ProductCategory } from '../../types/products';

// ─── Component ──────────────────────────────────────────────────────────────

export function CategoryTree() {
  const { roots, getChildren, all } = useCategoryTree();
  const products = useProductsStore((s) => s.products);
  const selectedCategoryId = useProductsStore((s) => s.selectedCategoryId);
  const selectCategory = useProductsStore((s) => s.selectCategory);
  const setFilters = useProductsStore((s) => s.setFilters);
  const setActiveSubTab = useProductsStore((s) => s.setActiveSubTab);
  const { createCategory, deleteCategory } = useProducts();

  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newParentId, setNewParentId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const getProductCount = (categoryId: string): number => {
    return products.filter(
      (p) => p.category_ids && p.category_ids.includes(categoryId)
    ).length;
  };

  const handleCategoryClick = (categoryId: string) => {
    selectCategory(categoryId);
    setFilters({ categoryId });
    setActiveSubTab('catalog');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsCreating(true);
    const slug = newName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    await createCategory({
      name: newName.trim(),
      slug,
      parent_id: newParentId || undefined,
    });

    setNewName('');
    setNewParentId('');
    setShowNewForm(false);
    setIsCreating(false);
  };

  const handleDelete = async (categoryId: string) => {
    if (confirmDeleteId !== categoryId) {
      setConfirmDeleteId(categoryId);
      return;
    }
    await deleteCategory(categoryId);
    setConfirmDeleteId(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-zinc-100">Categories</h2>
          <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
            {all.length}
          </span>
        </div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="px-4 py-1.5 bg-amber-500 text-black text-sm font-medium rounded-lg hover:bg-amber-400 transition-colors"
        >
          New Category
        </button>
      </div>

      {/* New Category Form */}
      {showNewForm && (
        <form
          onSubmit={handleCreate}
          className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/30 space-y-3"
        >
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Category name"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Parent Category
            </label>
            <select
              value={newParentId}
              onChange={(e) => setNewParentId(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
            >
              <option value="">None (top-level)</option>
              {all.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNewForm(false)}
              className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newName.trim() || isCreating}
              className="px-4 py-1.5 text-sm bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isCreating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      )}

      {/* Category Tree */}
      <div className="flex-1 overflow-y-auto p-4">
        {roots.length === 0 ? (
          <div className="text-center text-zinc-600 py-12">
            <p className="text-sm">No categories yet</p>
            <p className="text-xs mt-1">Create a category to organize products</p>
          </div>
        ) : (
          <div className="space-y-1">
            {roots.map((root) => (
              <CategoryNode
                key={root.id}
                category={root}
                getChildren={getChildren}
                getProductCount={getProductCount}
                selectedCategoryId={selectedCategoryId}
                onCategoryClick={handleCategoryClick}
                onDelete={handleDelete}
                confirmDeleteId={confirmDeleteId}
                depth={0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Category Node ──────────────────────────────────────────────────────────

function CategoryNode({
  category,
  getChildren,
  getProductCount,
  selectedCategoryId,
  onCategoryClick,
  onDelete,
  confirmDeleteId,
  depth,
}: {
  category: ProductCategory;
  getChildren: (parentId: string) => ProductCategory[];
  getProductCount: (categoryId: string) => number;
  selectedCategoryId: string | null;
  onCategoryClick: (id: string) => void;
  onDelete: (id: string) => void;
  confirmDeleteId: string | null;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const children = getChildren(category.id);
  const productCount = getProductCount(category.id);
  const hasChildren = children.length > 0;

  return (
    <div>
      <div
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors group
          ${selectedCategoryId === category.id
            ? 'bg-amber-500/10 border border-amber-500/30'
            : 'hover:bg-zinc-800/50 border border-transparent'
          }
        `}
        style={{ paddingLeft: `${12 + depth * 20}px` }}
      >
        {/* Expand toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className={`text-zinc-500 hover:text-zinc-300 transition-colors w-4 h-4 flex items-center justify-center shrink-0 ${
            !hasChildren ? 'invisible' : ''
          }`}
        >
          <svg
            className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Name + count */}
        <div
          className="flex-1 flex items-center gap-2 min-w-0"
          onClick={() => onCategoryClick(category.id)}
        >
          <span className="text-sm text-zinc-200 truncate">{category.name}</span>
          <span className="text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded-full shrink-0">
            {productCount}
          </span>
        </div>

        {/* Delete */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(category.id);
          }}
          className={`text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-all ${
            confirmDeleteId === category.id
              ? 'opacity-100 bg-red-500/30 text-red-300'
              : 'text-zinc-600 hover:text-red-400'
          }`}
          title={
            confirmDeleteId === category.id
              ? 'Click again to confirm delete'
              : 'Delete category'
          }
        >
          {confirmDeleteId === category.id ? 'Confirm?' : '✕'}
        </button>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div>
          {children.map((child) => (
            <CategoryNode
              key={child.id}
              category={child}
              getChildren={getChildren}
              getProductCount={getProductCount}
              selectedCategoryId={selectedCategoryId}
              onCategoryClick={onCategoryClick}
              onDelete={onDelete}
              confirmDeleteId={confirmDeleteId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

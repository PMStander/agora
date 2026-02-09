import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useCrmStore } from '../stores/crm';
import type { SavedView, SavedViewEntityType, ViewFilters } from '../types/crm';

export function useSavedViews() {
  const store = useCrmStore();
  const initializedRef = useRef(false);
  const [views, setViews] = useState<SavedView[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Fetch all views + realtime subscription ──
  useEffect(() => {
    if (!isSupabaseConfigured() || initializedRef.current) return;
    initializedRef.current = true;

    setLoading(true);
    supabase
      .from('crm_saved_views')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('name')
      .then(({ data, error }) => {
        if (!error && data) {
          setViews(data as SavedView[]);
        }
        setLoading(false);
      });

    // Realtime subscription
    const channel = supabase
      .channel('crm-saved-views-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crm_saved_views' },
        (payload) => {
          switch (payload.eventType) {
            case 'INSERT':
              setViews((prev) => {
                const view = payload.new as SavedView;
                const idx = prev.findIndex((v) => v.id === view.id);
                if (idx !== -1) return prev;
                return [view, ...prev];
              });
              break;
            case 'UPDATE':
              setViews((prev) =>
                prev.map((v) =>
                  v.id === (payload.new as SavedView).id
                    ? { ...v, ...(payload.new as Partial<SavedView>) }
                    : v
                )
              );
              break;
            case 'DELETE':
              if (payload.old?.id) {
                setViews((prev) => prev.filter((v) => v.id !== payload.old!.id));
                // Clear active view if it was deleted
                if (store.activeViewId === payload.old.id) {
                  store.setActiveViewId(null);
                }
              }
              break;
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived data ──

  const pinnedViews = views.filter((v) => v.is_pinned);

  const viewsByEntityType = useCallback(
    (entityType: SavedViewEntityType) =>
      views.filter((v) => v.entity_type === entityType),
    [views]
  );

  const activeView = views.find((v) => v.id === store.activeViewId) ?? null;

  // ── CRUD operations ──

  const saveView = useCallback(
    async (
      name: string,
      entityType: SavedViewEntityType,
      filters: ViewFilters,
      options?: {
        sortField?: string;
        sortDirection?: 'asc' | 'desc';
        icon?: string;
        color?: string;
        isPinned?: boolean;
      }
    ): Promise<SavedView | null> => {
      const { data, error } = await supabase
        .from('crm_saved_views')
        .insert({
          name,
          entity_type: entityType,
          filters,
          sort_field: options?.sortField ?? null,
          sort_direction: options?.sortDirection ?? 'asc',
          icon: options?.icon ?? null,
          color: options?.color ?? null,
          is_pinned: options?.isPinned ?? false,
        })
        .select()
        .single();

      if (error) {
        console.error('[SavedViews] Error saving view:', error);
        return null;
      }

      const view = data as SavedView;
      setViews((prev) => [view, ...prev]);
      return view;
    },
    []
  );

  const updateView = useCallback(
    async (viewId: string, updates: Partial<SavedView>): Promise<void> => {
      const { error } = await supabase
        .from('crm_saved_views')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', viewId);

      if (error) {
        console.error('[SavedViews] Error updating view:', error);
        return;
      }

      setViews((prev) =>
        prev.map((v) => (v.id === viewId ? { ...v, ...updates } : v))
      );
    },
    []
  );

  const deleteView = useCallback(
    async (viewId: string): Promise<void> => {
      const { error } = await supabase
        .from('crm_saved_views')
        .delete()
        .eq('id', viewId);

      if (error) {
        console.error('[SavedViews] Error deleting view:', error);
        return;
      }

      setViews((prev) => prev.filter((v) => v.id !== viewId));
      if (store.activeViewId === viewId) {
        store.setActiveViewId(null);
      }
    },
    [store]
  );

  const applyView = useCallback(
    (view: SavedView) => {
      const filters = view.filters;
      store.setFilters({
        lifecycleStatus: filters.lifecycleStatus ?? 'all',
        dealStatus: filters.dealStatus ?? 'all',
        ownerAgent: filters.ownerAgent ?? null,
        tags: filters.tags ?? [],
      });
      store.setSearchQuery(filters.searchQuery ?? '');
      store.setActiveViewId(view.id);

      // Switch to the correct sub-tab for the entity type
      if (
        view.entity_type === 'contacts' ||
        view.entity_type === 'companies' ||
        view.entity_type === 'deals'
      ) {
        store.setActiveSubTab(view.entity_type);
      }
    },
    [store]
  );

  const clearActiveView = useCallback(() => {
    store.setActiveViewId(null);
  }, [store]);

  const togglePin = useCallback(
    async (viewId: string) => {
      const view = views.find((v) => v.id === viewId);
      if (!view) return;
      await updateView(viewId, { is_pinned: !view.is_pinned });
    },
    [views, updateView]
  );

  return {
    views,
    pinnedViews,
    viewsByEntityType,
    activeView,
    loading,
    saveView,
    updateView,
    deleteView,
    applyView,
    clearActiveView,
    togglePin,
    isConfigured: isSupabaseConfigured(),
  };
}

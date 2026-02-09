import { useState, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useCrmStore } from '../stores/crm';
import {
  findDuplicateContacts,
  computeMergedFields,
  type DuplicateGroup,
} from '../lib/duplicateDetection';

// ─── Dismissed Duplicates (localStorage) ────────────────────────────────────

const DISMISSED_KEY = 'agora-dismissed-duplicates-v1';

interface DismissedEntry {
  /** Sorted contact IDs joined with "|" */
  key: string;
  matchType: string;
  dismissedAt: string;
}

function loadDismissed(): DismissedEntry[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDismissed(entries: DismissedEntry[]) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(entries));
}

function makeDismissKey(contactIds: string[]): string {
  return [...contactIds].sort().join('|');
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useDuplicateDetection() {
  const contacts = useCrmStore((s) => s.contacts);
  const updateContact = useCrmStore((s) => s.updateContact);
  const removeContact = useCrmStore((s) => s.removeContact);

  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [merging, setMerging] = useState<string | null>(null); // primary ID being merged
  const [dismissed, setDismissed] = useState<DismissedEntry[]>(loadDismissed);

  // ── Derived: filter out dismissed groups ──
  const activeGroups = useMemo(() => {
    const dismissedKeys = new Set(dismissed.map((d) => d.key));
    return duplicateGroups.filter((group) => {
      const key = makeDismissKey(group.contacts.map((c) => c.id));
      return !dismissedKeys.has(key);
    });
  }, [duplicateGroups, dismissed]);

  // ── Find duplicates ──
  const findDuplicates = useCallback(() => {
    setIsScanning(true);
    // Run detection synchronously (pure CPU, no async needed)
    const groups = findDuplicateContacts(contacts);
    setDuplicateGroups(groups);
    setIsScanning(false);
    return groups;
  }, [contacts]);

  // ── Merge contacts ──
  const mergeContacts = useCallback(
    async (primaryId: string, duplicateIds: string[]) => {
      if (!isSupabaseConfigured()) {
        console.warn('[DuplicateDetection] Supabase not configured, cannot merge');
        return false;
      }

      setMerging(primaryId);

      try {
        const primary = contacts.find((c) => c.id === primaryId);
        const duplicates = contacts.filter((c) => duplicateIds.includes(c.id));

        if (!primary || duplicates.length === 0) {
          console.error('[DuplicateDetection] Primary or duplicates not found');
          setMerging(null);
          return false;
        }

        // 1. Compute merged fields for the primary contact
        const mergedFields = computeMergedFields(primary, duplicates);

        // 2. Update primary contact with merged fields
        if (Object.keys(mergedFields).length > 0) {
          const { error: updateError } = await supabase
            .from('contacts')
            .update({ ...mergedFields, updated_at: new Date().toISOString() })
            .eq('id', primaryId);

          if (updateError) {
            console.error('[DuplicateDetection] Error updating primary:', updateError);
            setMerging(null);
            return false;
          }
          updateContact(primaryId, mergedFields);
        }

        // 3. Reassign all related records from duplicates to primary
        for (const dupId of duplicateIds) {
          // Reassign deals
          const { error: dealsError } = await supabase
            .from('deals')
            .update({ contact_id: primaryId, updated_at: new Date().toISOString() })
            .eq('contact_id', dupId);
          if (dealsError) {
            console.error('[DuplicateDetection] Error reassigning deals:', dealsError);
          }

          // Reassign CRM interactions
          const { error: interactionsError } = await supabase
            .from('crm_interactions')
            .update({ contact_id: primaryId, updated_at: new Date().toISOString() })
            .eq('contact_id', dupId);
          if (interactionsError) {
            console.error('[DuplicateDetection] Error reassigning interactions:', interactionsError);
          }

          // Reassign emails
          const { error: emailsError } = await supabase
            .from('emails')
            .update({ contact_id: primaryId })
            .eq('contact_id', dupId);
          if (emailsError) {
            console.error('[DuplicateDetection] Error reassigning emails:', emailsError);
          }

          // Reassign calendar events
          const { error: eventsError } = await supabase
            .from('calendar_events')
            .update({ contact_id: primaryId })
            .eq('contact_id', dupId);
          if (eventsError) {
            console.error('[DuplicateDetection] Error reassigning events:', eventsError);
          }

          // 4. Delete the duplicate contact
          const { error: deleteError } = await supabase
            .from('contacts')
            .delete()
            .eq('id', dupId);
          if (deleteError) {
            console.error('[DuplicateDetection] Error deleting duplicate:', deleteError);
          } else {
            removeContact(dupId);
          }
        }

        // 5. Update local deals + interactions stores to reflect reassignment
        const storeState = useCrmStore.getState();
        const updatedDeals = storeState.deals.map((d) =>
          duplicateIds.includes(d.contact_id ?? '')
            ? { ...d, contact_id: primaryId }
            : d
        );
        useCrmStore.setState({ deals: updatedDeals });

        const updatedInteractions = storeState.interactions.map((i) =>
          duplicateIds.includes(i.contact_id ?? '')
            ? { ...i, contact_id: primaryId }
            : i
        );
        useCrmStore.setState({ interactions: updatedInteractions });

        // 6. Remove merged group from state
        setDuplicateGroups((prev) =>
          prev.filter((g) => {
            const groupIds = g.contacts.map((c) => c.id);
            return !groupIds.includes(primaryId) && !groupIds.some((id) => duplicateIds.includes(id));
          })
        );

        setMerging(null);
        return true;
      } catch (err) {
        console.error('[DuplicateDetection] Merge error:', err);
        setMerging(null);
        return false;
      }
    },
    [contacts, updateContact, removeContact]
  );

  // ── Dismiss a duplicate group ──
  const dismissDuplicate = useCallback(
    (groupIndex: number) => {
      const group = activeGroups[groupIndex];
      if (!group) return;

      const entry: DismissedEntry = {
        key: makeDismissKey(group.contacts.map((c) => c.id)),
        matchType: group.matchType,
        dismissedAt: new Date().toISOString(),
      };

      const updated = [...dismissed, entry];
      setDismissed(updated);
      saveDismissed(updated);
    },
    [activeGroups, dismissed]
  );

  // ── Clear all dismissals ──
  const clearDismissals = useCallback(() => {
    setDismissed([]);
    localStorage.removeItem(DISMISSED_KEY);
  }, []);

  return {
    /** Run duplicate detection on current contacts */
    findDuplicates,
    /** All detected duplicate groups (including dismissed) */
    allGroups: duplicateGroups,
    /** Active (non-dismissed) duplicate groups */
    activeGroups,
    /** Whether a scan is in progress */
    isScanning,
    /** ID of the primary contact currently being merged, or null */
    merging,
    /** Merge duplicates into a primary contact */
    mergeContacts,
    /** Dismiss a group as "not a duplicate" */
    dismissDuplicate,
    /** Clear all dismissals */
    clearDismissals,
  };
}

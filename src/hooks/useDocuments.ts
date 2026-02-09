import { useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { CrmDocument, DocType, DocStatus, DocumentEntityType } from '../types/documents';

const STORAGE_BUCKET = 'crm-documents';

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useDocuments() {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // ── Fetch documents for a specific entity ──

  const fetchDocuments = useCallback(
    async (entityType: DocumentEntityType, entityId: string): Promise<CrmDocument[]> => {
      if (!isSupabaseConfigured()) return [];

      const fkColumn = `${entityType}_id`;
      const { data, error } = await supabase
        .from('crm_documents')
        .select('*')
        .eq(fkColumn, entityId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Documents] Error fetching documents:', error);
        return [];
      }
      return data as CrmDocument[];
    },
    []
  );

  // ── Upload document ──

  const uploadDocument = useCallback(
    async (
      file: File,
      metadata: {
        title?: string;
        description?: string;
        doc_type?: DocType;
        contact_id?: string;
        company_id?: string;
        deal_id?: string;
        project_id?: string;
        quote_id?: string;
        invoice_id?: string;
        owner_agent_id?: string;
        tags?: string[];
      }
    ): Promise<CrmDocument | null> => {
      if (!isSupabaseConfigured()) return null;

      setUploading(true);
      setUploadProgress(0);

      try {
        // Generate a unique storage path
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `${timestamp}_${safeName}`;

        // Upload to Supabase Storage
        setUploadProgress(20);
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.error('[Documents] Upload error:', uploadError);
          return null;
        }

        setUploadProgress(70);

        // Create DB record
        const record = {
          title: metadata.title || file.name,
          description: metadata.description || null,
          doc_type: metadata.doc_type || 'file',
          storage_path: storagePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type || null,
          contact_id: metadata.contact_id || null,
          company_id: metadata.company_id || null,
          deal_id: metadata.deal_id || null,
          project_id: metadata.project_id || null,
          quote_id: metadata.quote_id || null,
          invoice_id: metadata.invoice_id || null,
          owner_agent_id: metadata.owner_agent_id || null,
          tags: metadata.tags || [],
        };

        const { data, error: dbError } = await supabase
          .from('crm_documents')
          .insert(record)
          .select()
          .single();

        if (dbError) {
          console.error('[Documents] DB insert error:', dbError);
          // Try to clean up the uploaded file
          await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
          return null;
        }

        setUploadProgress(100);
        return data as CrmDocument;
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
    []
  );

  // ── Delete document ──

  const deleteDocument = useCallback(
    async (doc: CrmDocument): Promise<boolean> => {
      if (!isSupabaseConfigured()) return false;

      setLoading(true);
      try {
        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([doc.storage_path]);

        if (storageError) {
          console.error('[Documents] Storage delete error:', storageError);
          // Continue to delete DB record even if storage fails
        }

        // Delete DB record
        const { error: dbError } = await supabase
          .from('crm_documents')
          .delete()
          .eq('id', doc.id);

        if (dbError) {
          console.error('[Documents] DB delete error:', dbError);
          return false;
        }

        return true;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ── Download document ──

  const downloadDocument = useCallback(
    async (doc: CrmDocument): Promise<void> => {
      if (!isSupabaseConfigured()) return;

      setLoading(true);
      try {
        const { data, error } = await supabase.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(doc.storage_path, 60); // 60 second expiry

        if (error || !data?.signedUrl) {
          console.error('[Documents] Signed URL error:', error);
          return;
        }

        // Trigger download
        const link = document.createElement('a');
        link.href = data.signedUrl;
        link.download = doc.file_name;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ── Update document metadata ──

  const updateDocument = useCallback(
    async (
      documentId: string,
      updates: Partial<Pick<CrmDocument, 'title' | 'description' | 'doc_type' | 'status' | 'tags'>>
    ): Promise<CrmDocument | null> => {
      if (!isSupabaseConfigured()) return null;

      const { data, error } = await supabase
        .from('crm_documents')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', documentId)
        .select()
        .single();

      if (error) {
        console.error('[Documents] Update error:', error);
        return null;
      }
      return data as CrmDocument;
    },
    []
  );

  return {
    fetchDocuments,
    uploadDocument,
    deleteDocument,
    downloadDocument,
    updateDocument,
    loading,
    uploading,
    uploadProgress,
  };
}

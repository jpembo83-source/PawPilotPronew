import React, { useState, useEffect } from 'react';
import { PetDocument, DocumentType } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import {
  FileText,
  Plus,
  DownloadSimple,
  Trash,
  Warning,
  CheckCircle,
  CircleNotch
} from '@phosphor-icons/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../components/ui/dialog';
import { projectId } from '../../../../../utils/supabase/info';
import { getAuthHeaders } from '@/utils/supabase/authHeaders';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';
import { DocumentUploadForm, DOCUMENT_TYPES } from './forms/DocumentUploadForm';

interface DocumentManagerProps {
  householdId: string;
  petId?: string; // Optional - if provided, shows pet-specific docs
  showHouseholdDocs?: boolean; // Show household-level docs (like waivers)
}

export function DocumentManager({ householdId, petId, showHouseholdDocs = true }: DocumentManagerProps) {
  const [documents, setDocuments] = useState<PetDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirmDialog();

  useEffect(() => {
    fetchDocuments();
  }, [householdId, petId]);

  const fetchDocuments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/customers/households/${householdId}/documents`,
        {
          headers: await getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }

      const data = await response.json();
      let docs = data.documents || [];
      
      // Filter based on props
      if (petId && showHouseholdDocs) {
        // Show both pet-specific AND household documents
        docs = docs.filter((d: PetDocument) => d.pet_id === petId || !d.pet_id);
      } else if (petId) {
        // Pet-specific only
        docs = docs.filter((d: PetDocument) => d.pet_id === petId);
      } else if (showHouseholdDocs) {
        // Household-level docs only
        docs = docs.filter((d: PetDocument) => !d.pet_id);
      }
      
      setDocuments(docs);
    } catch (err: any) {
      console.error('Failed to fetch documents:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setShowAddModal(true);
  };

  // The upload form's state lives inside DocumentUploadForm and resets on
  // dialog unmount, so closing is just hiding the modal.
  const handleCloseModal = () => {
    setShowAddModal(false);
  };

  const handleDelete = async (documentId: string) => {
    const confirmed = await confirm({
      title: 'Delete this document?',
      description: 'This document will be permanently deleted.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/customers/households/${householdId}/documents/${documentId}`,
        {
          method: 'DELETE',
          headers: await getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete document');
      }

      await fetchDocuments();
    } catch (err: any) {
      console.error('Failed to delete document:', err);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDocumentStatus = (doc: PetDocument) => {
    if (!doc.expiry_date) {
      return { status: 'none', label: null, variant: null };
    }

    const expiryDate = new Date(doc.expiry_date);
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    if (expiryDate < today) {
      return { status: 'expired', label: 'Expired', variant: 'destructive' as const };
    } else if (expiryDate <= thirtyDaysFromNow) {
      return { status: 'expiring_soon', label: 'Expiring Soon', variant: 'secondary' as const };
    } else {
      return { status: 'valid', label: 'Valid', variant: 'default' as const };
    }
  };

  const getDocumentTypeInfo = (type: DocumentType) => {
    return DOCUMENT_TYPES.find(t => t.value === type) || { label: type, description: '' };
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CircleNotch className="h-8 w-8 animate-spin mx-auto text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5" />
              <CardTitle>
                {petId && showHouseholdDocs ? 'Pet & Household Documents' : petId ? 'Pet Documents' : 'Household Documents'}
              </CardTitle>
            </div>
            <Button onClick={handleOpenAddModal} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
              <Warning className="h-4 w-4" />
              {error}
            </div>
          )}

          {documents.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <FileText className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">No documents uploaded</p>
              <p className="text-sm mt-1">Upload waivers, vaccination certificates, and other documents</p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((document) => {
                const status = getDocumentStatus(document);
                const typeInfo = getDocumentTypeInfo(document.document_type);
                
                return (
                  <div
                    key={document.id}
                    className="p-4 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="h-4 w-4 text-slate-400" />
                          <h4 className="font-semibold text-slate-900">{document.name}</h4>
                          <Badge variant="outline">{typeInfo.label}</Badge>
                          {status.label && status.variant && (
                            <Badge variant={status.variant}>{status.label}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{typeInfo.description}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(document.storage_path, '_blank')}
                          disabled={isSubmitting}
                          title="DownloadSimple"
                        >
                          <DownloadSimple className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(document.id)}
                          disabled={isSubmitting}
                          title="Delete"
                        >
                          <Trash className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-slate-600 mb-0.5">File Name</p>
                        <p className="font-medium font-mono text-xs">{document.file_name}</p>
                      </div>
                      {document.expiry_date && (
                        <div>
                          <p className="text-slate-600 mb-0.5">Expiry Date</p>
                          <div className="flex items-center gap-2">
                            {status.status === 'expired' && <Warning className="h-3.5 w-3.5 text-red-500" />}
                            {status.status === 'expiring_soon' && <Warning className="h-3.5 w-3.5 text-orange-500" />}
                            {status.status === 'valid' && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
                            <p className="font-medium">
                              {new Date(document.expiry_date).toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </p>
                          </div>
                        </div>
                      )}
                      <div>
                        <p className="text-slate-600 mb-0.5">Uploaded</p>
                        <p className="font-medium">
                          {new Date(document.uploaded_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-600 mb-0.5">File Size</p>
                        <p className="font-medium">
                          {(document.file_size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>

                    {document.notes && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-xs text-slate-600 mb-1">Notes</p>
                        <p className="text-sm text-slate-700">{document.notes}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* UploadSimple Modal */}
      <Dialog open={showAddModal} onOpenChange={handleCloseModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload a waiver, vaccination certificate, or other document for this {petId ? 'pet' : 'household'}.
            </DialogDescription>
          </DialogHeader>

          <DocumentUploadForm
            householdId={householdId}
            petId={petId}
            onUploaded={async () => {
              await fetchDocuments();
              handleCloseModal();
            }}
            onCancel={handleCloseModal}
          />
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </>
  );
}
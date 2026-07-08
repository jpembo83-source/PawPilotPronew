// Shared document upload form — extracted from DocumentManager's upload modal
// so the onboarding wizard's waiver step and the Documents tab share one
// upload implementation (fields + multipart POST).

import { useState } from 'react';
import { CircleNotch, FileText, UploadSimple, Warning } from '@phosphor-icons/react';
import { Button } from '../../../../components/ui/button';
import { DialogFooter } from '../../../../components/ui/dialog';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Textarea } from '../../../../components/ui/textarea';
import { projectId } from '../../../../../../utils/supabase/info';
import { getAuthHeaders } from '@/utils/supabase/authHeaders';
import type { DocumentType } from '../../types';

export const DOCUMENT_TYPES: { value: DocumentType; label: string; description: string; requiresExpiry?: boolean }[] = [
  { value: 'waiver', label: 'Waiver / Consent Form', description: 'Liability waiver', requiresExpiry: true },
  { value: 'vaccination', label: 'Vaccination Certificate', description: 'Vaccination records', requiresExpiry: true },
  { value: 'insurance', label: 'Insurance Certificate', description: 'Pet insurance', requiresExpiry: true },
  { value: 'medical', label: 'Medical Record', description: 'Medical documents', requiresExpiry: false },
  { value: 'photo_id', label: 'Photo ID', description: 'Identification document', requiresExpiry: false },
  { value: 'other', label: 'Other', description: 'Other documents', requiresExpiry: false },
];

interface DocumentUploadFormProps {
  householdId: string;
  petId?: string;
  initialType?: DocumentType;
  submitLabel?: string;
  onUploaded: () => void | Promise<void>;
  onCancel?: () => void;
}

export function DocumentUploadForm({
  householdId,
  petId,
  initialType = 'waiver',
  submitLabel = 'Upload Document',
  onUploaded,
  onCancel,
}: DocumentUploadFormProps) {
  const [formData, setFormData] = useState({
    document_type: initialType,
    name: '',
    expiry_date: '',
    notes: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedDocType = DOCUMENT_TYPES.find(t => t.value === formData.document_type);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Auto-fill name if empty
      if (!formData.name) {
        setFormData({ ...formData, name: file.name });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      setError('Please select a file to upload');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Create FormData for file upload
      const uploadData = new FormData();
      uploadData.append('file', selectedFile);
      uploadData.append('document_type', formData.document_type);
      uploadData.append('name', formData.name || selectedFile.name);
      if (formData.expiry_date) {
        uploadData.append('expiry_date', formData.expiry_date);
      }
      if (formData.notes) {
        uploadData.append('notes', formData.notes);
      }
      if (petId) {
        uploadData.append('pet_id', petId);
      }

      // FormData posts must not send the JSON Content-Type the shared util
      // adds — the browser sets the multipart boundary itself.
      const auth: Record<string, string> = { ...(await getAuthHeaders()) };
      delete auth['Content-Type'];
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/customers/households/${householdId}/documents`,
        {
          method: 'POST',
          headers: auth,
          body: uploadData,
        }
      );

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errorData.error || 'Failed to upload document');
      }

      await onUploaded();
    } catch (err) {
      console.error('Failed to upload document:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      {/* Document Type */}
      <div>
        <Label htmlFor="document_type">Document Type *</Label>
        <select
          id="document_type"
          value={formData.document_type}
          onChange={(e) => setFormData({ ...formData, document_type: e.target.value as DocumentType })}
          className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          required
        >
          {DOCUMENT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label} - {type.description}
            </option>
          ))}
        </select>
        {selectedDocType?.requiresExpiry && (
          <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
            <Warning className="h-3 w-3" />
            This document type requires an expiry date for compliance tracking
          </p>
        )}
      </div>

      {/* File UploadSimple */}
      <div>
        <Label htmlFor="file">File *</Label>
        <div className="mt-1">
          <input
            type="file"
            id="file"
            onChange={handleFileSelect}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
          <p className="text-xs text-slate-500 mt-1">
            Supported formats: PDF, DOC, DOCX, JPG, PNG (Max 10MB)
          </p>
        </div>
        {selectedFile && (
          <div className="mt-2 p-2 bg-slate-50 rounded border border-slate-200 flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-400" />
            <span className="text-sm">{selectedFile.name}</span>
            <span className="text-xs text-slate-500">
              ({(selectedFile.size / 1024).toFixed(1)} KB)
            </span>
          </div>
        )}
      </div>

      {/* Document Name */}
      <div>
        <Label htmlFor="name">Document Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Liability Waiver 2026"
          required
        />
      </div>

      {/* Expiry Date */}
      <div>
        <Label htmlFor="expiry_date">
          Expiry Date {selectedDocType?.requiresExpiry && '*'}
        </Label>
        <Input
          id="expiry_date"
          type="date"
          value={formData.expiry_date}
          onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
          min={new Date().toISOString().split('T')[0]}
          required={selectedDocType?.requiresExpiry}
        />
        {selectedDocType?.requiresExpiry && (
          <p className="text-xs text-slate-500 mt-1">
            Required for compliance tracking and check-in validation
          </p>
        )}
      </div>

      {/* Notes */}
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Any additional notes about this document"
          rows={3}
        />
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <Warning className="h-4 w-4" />
          {error}
        </div>
      )}

      <DialogFooter>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting || !selectedFile}>
          {isSubmitting ? (
            <>
              <CircleNotch className="h-4 w-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <UploadSimple className="h-4 w-4 mr-2" />
              {submitLabel}
            </>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

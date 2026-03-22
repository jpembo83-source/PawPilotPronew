// Policy Compliance Export Utilities
// Generate audit-ready exports for employment compliance documentation

import { supabase } from '@/utils/supabase/client';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';

interface AcknowledgementRecord {
  id: string;
  policy_id: string;
  policy_version_id: string;
  assignment_id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  acknowledged_at: string;
  typed_name?: string;
  acknowledgement_text?: string;
  metadata?: {
    ip_address?: string;
    user_agent?: string;
  };
}

interface ExportOptions {
  format: 'csv' | 'json';
  filename?: string;
  includeMetadata?: boolean;
}

export async function exportAcknowledgements(options: ExportOptions = { format: 'csv' }): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/staff/policies/export/acknowledgements`,
      {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-User-Token': `Bearer ${session.access_token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to export acknowledgements');
    }

    const data = await response.json();
    const acknowledgements: AcknowledgementRecord[] = data.acknowledgements || [];

    if (options.format === 'csv') {
      downloadAsCSV(acknowledgements, options);
    } else {
      downloadAsJSON(data, options);
    }
  } catch (error: any) {
    console.error('Export error:', error);
    throw error;
  }
}

function downloadAsCSV(records: AcknowledgementRecord[], options: ExportOptions): void {
  // Define CSV headers
  const headers = [
    'Acknowledgement ID',
    'Policy ID',
    'Version ID',
    'Staff Name',
    'Staff Email',
    'Typed Name',
    'Acknowledged At (UTC)',
    'Acknowledgement Text',
    ...(options.includeMetadata ? ['IP Address', 'User Agent'] : []),
  ];

  // Build CSV rows
  const rows = records.map(record => [
    record.id,
    record.policy_id,
    record.policy_version_id,
    record.user_name || '',
    record.user_email || '',
    record.typed_name || '',
    record.acknowledged_at,
    record.acknowledgement_text || 'I confirm that I have read, understood, and agree to comply with this policy.',
    ...(options.includeMetadata ? [
      record.metadata?.ip_address || '',
      record.metadata?.user_agent || '',
    ] : []),
  ]);

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  // Add BOM for Excel compatibility
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  
  downloadBlob(blob, options.filename || `policy-acknowledgements-${formatDateForFilename(new Date())}.csv`);
}

function downloadAsJSON(data: any, options: ExportOptions): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, options.filename || `policy-acknowledgements-${formatDateForFilename(new Date())}.json`);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatDateForFilename(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Generate a compliance summary report
export async function exportComplianceSummary(options: ExportOptions = { format: 'csv' }): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/staff/policies/compliance/by-policy`,
      {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-User-Token': `Bearer ${session.access_token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to export compliance summary');
    }

    const complianceData = await response.json();

    if (options.format === 'csv') {
      // Build compliance summary CSV
      const headers = [
        'Policy Title',
        'Category',
        'Status',
        'Total Assigned',
        'Acknowledged',
        'Pending',
        'Overdue',
        'Completion Rate (%)',
      ];

      const rows = complianceData.map((item: any) => [
        item.policy_title,
        item.policy_category,
        item.policy_status,
        item.total_assignments,
        item.acknowledged,
        item.pending,
        item.overdue,
        item.completion_rate,
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row: any[]) => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      downloadBlob(blob, options.filename || `policy-compliance-summary-${formatDateForFilename(new Date())}.csv`);
    } else {
      const blob = new Blob([JSON.stringify(complianceData, null, 2)], { type: 'application/json' });
      downloadBlob(blob, options.filename || `policy-compliance-summary-${formatDateForFilename(new Date())}.json`);
    }
  } catch (error: any) {
    console.error('Export error:', error);
    throw error;
  }
}

// Export audit trail
export async function exportAuditTrail(options: ExportOptions = { format: 'csv' }): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/staff/policies/audit`,
      {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-User-Token': `Bearer ${session.access_token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to export audit trail');
    }

    const auditData = await response.json();

    if (options.format === 'csv') {
      const headers = [
        'Timestamp (UTC)',
        'Action',
        'Entity Type',
        'Entity ID',
        'Actor Name',
        'Actor Email',
        'Details',
      ];

      const rows = auditData.map((item: any) => [
        item.timestamp,
        item.action,
        item.entity_type,
        item.entity_id,
        item.actor_name,
        item.actor_email || '',
        JSON.stringify(item.details),
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row: any[]) => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      downloadBlob(blob, options.filename || `policy-audit-trail-${formatDateForFilename(new Date())}.csv`);
    } else {
      const blob = new Blob([JSON.stringify(auditData, null, 2)], { type: 'application/json' });
      downloadBlob(blob, options.filename || `policy-audit-trail-${formatDateForFilename(new Date())}.json`);
    }
  } catch (error: any) {
    console.error('Export error:', error);
    throw error;
  }
}

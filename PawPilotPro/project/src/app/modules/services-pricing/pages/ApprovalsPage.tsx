import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Clock, Eye, Warning, TrendUp, TrendDown } from '@phosphor-icons/react';
import { useApprovalsStore } from '../stores/approvals-store';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Card } from '../../../components/ui/card';
import { Approval, ImpactPreview } from '../types/approvals';
import { toast } from 'sonner';

export function ApprovalsPage() {
  const {
    pendingApprovals,
    approvalHistory,
    impactPreview,
    isLoading,
    isSubmitting,
    fetchPendingApprovals,
    fetchApprovalHistory,
    approvePriceBook,
    rejectPriceBook,
    approveLocationOverride,
    rejectLocationOverride,
    generateImpactPreview,
  } = useApprovalsStore();

  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [showImpactPreview, setShowImpactPreview] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalComment, setApprovalComment] = useState('');
  const [activateImmediately, setActivateImmediately] = useState(true);

  useEffect(() => {
    // Only fetch if user has navigated to this page
    // Use a small delay to ensure the component is fully mounted
    const timer = setTimeout(() => {
      fetchPendingApprovals().catch(err => {
        // Silently handle errors - they're already logged in the store
      });
      fetchApprovalHistory().catch(err => {
        // Silently handle errors - they're already logged in the store
      });
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  const handleViewImpact = async (approval: Approval) => {
    setSelectedApproval(approval);
    try {
      await generateImpactPreview(approval.type, approval.referenceId);
      setShowImpactPreview(true);
    } catch (e: any) {
      toast.error('Failed to generate impact preview: ' + e.message);
    }
  };

  const handleApprove = async (approval: Approval) => {
    try {
      if (approval.type === 'price_book') {
        await approvePriceBook({
          priceBookVersionId: approval.referenceId,
          approvalComment,
          activateImmediately,
        });
        toast.success('Price book approved successfully');
      } else if (approval.type === 'location_override') {
        await approveLocationOverride({
          proposalId: approval.referenceId,
          approvalComment,
        });
        toast.success('Location override approved successfully');
      }
      setSelectedApproval(null);
      setShowImpactPreview(false);
      setApprovalComment('');
    } catch (e: any) {
      toast.error('Approval failed: ' + e.message);
    }
  };

  const handleReject = async (approval: Approval) => {
    if (!rejectionReason) {
      toast.error('Rejection reason is required');
      return;
    }

    try {
      if (approval.type === 'price_book') {
        await rejectPriceBook({
          priceBookVersionId: approval.referenceId,
          rejectionReason,
        });
        toast.success('Price book rejected');
      } else if (approval.type === 'location_override') {
        await rejectLocationOverride({
          proposalId: approval.referenceId,
          rejectionReason,
        });
        toast.success('Location override rejected');
      }
      setSelectedApproval(null);
      setRejectionReason('');
    } catch (e: any) {
      toast.error('Rejection failed: ' + e.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Pricing Approvals</h1>
        <p className="text-sm text-slate-500 mt-1">
          Review and approve pricing changes with impact preview
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">{pendingApprovals.length}</p>
              <p className="text-xs text-slate-500">Pending Approval</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">
                {approvalHistory.filter(a => a.status === 'approved').length}
              </p>
              <p className="text-xs text-slate-500">Approved This Month</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-rose-50 flex items-center justify-center">
              <XCircle className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">
                {approvalHistory.filter(a => a.status === 'rejected').length}
              </p>
              <p className="text-xs text-slate-500">Rejected This Month</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="border-b border-slate-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'pending'
                  ? 'border-primary text-primary bg-secondary'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Clock className="inline h-4 w-4 mr-2" />
              Pending ({pendingApprovals.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'history'
                  ? 'border-primary text-primary bg-secondary'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              ClockCounterClockwise ({approvalHistory.length})
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'pending' && (
            <PendingApprovalsView
              approvals={pendingApprovals}
              onViewImpact={handleViewImpact}
              isLoading={isLoading}
            />
          )}
          {activeTab === 'history' && (
            <ApprovalHistoryView
              approvals={approvalHistory}
              isLoading={isLoading}
            />
          )}
        </div>
      </div>

      {/* Impact Preview Modal */}
      {showImpactPreview && selectedApproval && impactPreview && (
        <ImpactPreviewModal
          approval={selectedApproval}
          impactPreview={impactPreview}
          approvalComment={approvalComment}
          rejectionReason={rejectionReason}
          activateImmediately={activateImmediately}
          isSubmitting={isSubmitting}
          onApprovalCommentChange={setApprovalComment}
          onRejectionReasonChange={setRejectionReason}
          onActivateImmediatelyChange={setActivateImmediately}
          onApprove={() => handleApprove(selectedApproval)}
          onReject={() => handleReject(selectedApproval)}
          onClose={() => {
            setShowImpactPreview(false);
            setSelectedApproval(null);
            setApprovalComment('');
            setRejectionReason('');
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function PendingApprovalsView({ approvals, onViewImpact, isLoading }: any) {
  if (isLoading) {
    return <div className="text-center py-12 text-slate-500">Loading...</div>;
  }

  if (approvals.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Clock className="h-12 w-12 text-slate-300 mx-auto mb-4" />
        <p>No pending approvals</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {approvals.map((approval: Approval) => (
        <div
          key={approval.id}
          className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Badge variant="outline" className="text-xs">
                  {approval.type.replace('_', ' ')}
                </Badge>
                <Badge className="text-xs bg-amber-500">Pending Approval</Badge>
              </div>
              <p className="text-sm text-slate-600">
                Proposed by <span className="font-medium">{approval.proposedBy}</span> on{' '}
                {new Date(approval.proposedAt).toLocaleDateString()}
              </p>
              {approval.details && (
                <div className="mt-2 text-xs text-slate-500">
                  {approval.type === 'price_book' && (
                    <p>Price Book Version #{approval.details.version}</p>
                  )}
                  {approval.type === 'location_override' && (
                    <p>
                      CHF {approval.details.currentPrice} → CHF {approval.details.proposedPrice}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => onViewImpact(approval)}>
                <Eye className="h-4 w-4 mr-1" />
                Review
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ApprovalHistoryView({ approvals, isLoading }: any) {
  if (isLoading) {
    return <div className="text-center py-12 text-slate-500">Loading...</div>;
  }

  if (approvals.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>No approval history</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {approvals.map((approval: Approval) => (
        <div
          key={approval.id}
          className="border border-slate-200 rounded-lg p-4"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Badge variant="outline" className="text-xs">
                  {approval.type.replace('_', ' ')}
                </Badge>
                {approval.status === 'approved' && (
                  <Badge className="text-xs bg-emerald-500">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Approved
                  </Badge>
                )}
                {approval.status === 'rejected' && (
                  <Badge className="text-xs bg-rose-500">
                    <XCircle className="h-3 w-3 mr-1" />
                    Rejected
                  </Badge>
                )}
              </div>
              <p className="text-sm text-slate-600">
                Proposed by <span className="font-medium">{approval.proposedBy}</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {approval.status === 'approved' && approval.approvedBy && (
                  <>Approved by <span className="font-medium">{approval.approvedBy}</span> on{' '}
                  {new Date(approval.approvedAt!).toLocaleDateString()}</>
                )}
                {approval.status === 'rejected' && approval.rejectedBy && (
                  <>Rejected by <span className="font-medium">{approval.rejectedBy}</span> on{' '}
                  {new Date(approval.rejectedAt!).toLocaleDateString()}</>
                )}
              </p>
              {approval.rejectionReason && (
                <p className="text-xs text-rose-600 mt-2">
                  Reason: {approval.rejectionReason}
                </p>
              )}
              {approval.approvalComment && (
                <p className="text-xs text-emerald-600 mt-2">
                  Comment: {approval.approvalComment}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ImpactPreviewModal({
  approval,
  impactPreview,
  approvalComment,
  rejectionReason,
  activateImmediately,
  isSubmitting,
  onApprovalCommentChange,
  onRejectionReasonChange,
  onActivateImmediatelyChange,
  onApprove,
  onReject,
  onClose,
}: any) {
  const [showRejectForm, setShowRejectForm] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">Impact Preview</h2>
          <p className="text-sm text-slate-500 mt-1">
            Review the impact before approving this change
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4">
              <p className="text-xs text-slate-500">Services Affected</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">
                {impactPreview.servicesAffected.length}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-slate-500">Avg Price Change</p>
              <p className={`text-2xl font-semibold mt-1 ${impactPreview.averagePriceChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {impactPreview.averagePriceChange >= 0 ? '+' : ''}{impactPreview.averagePriceChange.toFixed(1)}%
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-slate-500">Effective Date</p>
              <p className="text-sm font-medium text-slate-900 mt-1">
                {new Date(impactPreview.effectiveDate).toLocaleDateString()}
              </p>
            </Card>
          </div>

          {/* Service Impacts */}
          <div>
            <h3 className="font-medium text-slate-900 mb-3">Pricing Changes</h3>
            <div className="space-y-2">
              {impactPreview.servicesAffected.map((service: any, index: number) => (
                <div key={index} className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-slate-900">{service.serviceName}</span>
                    {service.priceChangePercent >= 0 ? (
                      <div className="flex items-center gap-1 text-emerald-600">
                        <TrendUp className="h-4 w-4" />
                        <span className="text-sm font-medium">+{service.priceChangePercent.toFixed(1)}%</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-rose-600">
                        <TrendDown className="h-4 w-4" />
                        <span className="text-sm font-medium">{service.priceChangePercent.toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-slate-600">
                    CHF {service.oldPrice.toFixed(2)} → CHF {service.newPrice.toFixed(2)}
                    <span className="text-slate-400 ml-2">
                      ({service.priceChange >= 0 ? '+' : ''}CHF {service.priceChange.toFixed(2)})
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Approval/Rejection Form */}
          {!showRejectForm ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Approval Comment (Optional)
                </label>
                <textarea
                  value={approvalComment}
                  onChange={(e) => onApprovalCommentChange(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Add a comment about this approval..."
                />
              </div>
              {approval.type === 'price_book' && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="activate-immediately"
                    checked={activateImmediately}
                    onChange={(e) => onActivateImmediatelyChange(e.target.checked)}
                    className="h-4 w-4 text-primary border-slate-300 rounded"
                  />
                  <label htmlFor="activate-immediately" className="text-sm text-slate-700">
                    Activate immediately (otherwise scheduled for effective date)
                  </label>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Rejection Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => onRejectionReasonChange(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                rows={3}
                placeholder="Explain why this change is being rejected..."
              />
            </div>
          )}

          {/* Warning */}
          {impactPreview.upcomingBookingsImpacted > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
              <Warning className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-900">
                  {impactPreview.upcomingBookingsImpacted} upcoming booking(s) may be affected
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Existing bookings use locked pricing and will not be changed.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-200 flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          {!showRejectForm ? (
            <>
              <Button
                variant="outline"
                onClick={() => setShowRejectForm(true)}
                disabled={isSubmitting}
                className="text-rose-600 hover:text-rose-700"
              >
                <XCircle className="h-4 w-4 mr-1" />
                Reject
              </Button>
              <Button
                onClick={onApprove}
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                {isSubmitting ? 'Approving...' : 'Approve'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setShowRejectForm(false)} disabled={isSubmitting}>
                Back to Approval
              </Button>
              <Button
                onClick={onReject}
                disabled={isSubmitting || !rejectionReason}
                className="bg-rose-600 hover:bg-rose-700"
              >
                <XCircle className="h-4 w-4 mr-1" />
                {isSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
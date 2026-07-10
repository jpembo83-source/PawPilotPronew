import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { useCustomerStore } from '../store';
import { useDaycareStore } from '../../daycare/store';
import { useBillingStore } from '../../billing/store';
import { usePackagesStore } from '../../packages/store';
import { useAuth } from '../../../context/AuthContext';
import { useCurrency } from '../../../utils/currency';
import { useSettingsStore } from '../../settings/store';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Star,
  Prohibit,
  Warning,
  Plus,
  EnvelopeSimple,
  Phone,
  MapPin,
  Dog,
  CalendarBlank,
  Receipt,
  ChatTeardrop,
  FileText,
  Flag,
  PencilSimple,
  Check,
  X,
  ShieldWarning,
  Truck,
  Scissors,
  House,
  Trash
} from '@phosphor-icons/react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';
import { Avatar, AvatarFallback } from '../../../components/ui/avatar';

// Import tab components (we'll create these)
import { OverviewTab } from '../components/household-detail/OverviewTab';
import { ContactsTab } from '../components/household-detail/ContactsTab';
import { PetsTab } from '../components/household-detail/PetsTab';
import { MessagesTab } from '../components/household-detail/MessagesTab';
import { BookingsTab } from '../components/household-detail/BookingsTab';
import { BillingTab } from '../components/household-detail/BillingTab';
import { NotesTab } from '../components/household-detail/NotesTab';
import { PortalActivityTab } from '../components/household-detail/PortalActivityTab';
import { DocumentManager } from '../components/DocumentManager';
import { ContactLink } from '../components/ContactLink';
import { PortalStatusChip, usePortalStatus } from '../components/PortalStatusChip';

export function HouseholdDetailPage() {
  const { householdId } = useParams<{ householdId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { currentHouseholdDetail, isLoading, error, fetchHouseholdDetail, updateHousehold, deleteHousehold, flags, fetchFlags } = useCustomerStore();
  const { format: formatCurrency } = useCurrency();
  const { globalEnabledModules } = useSettingsStore();
  const { fetchCustomerPackages, customerPackages } = usePackagesStore();
  const [householdBookingCount, setHouseholdBookingCount] = useState(0);
  // null = not loaded (billing unreachable or still fetching); render "—", never a fake 0
  const [outstandingBalance, setOutstandingBalance] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Validate householdId - accept any non-empty ID that's not "new"
  // We'll let the backend validate if it actually exists
  const isValidId = householdId && householdId !== 'new';

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS

  // Portal status for the header chip; null (loading/failed) renders no chip.
  // Every role that can open this page can also see the Portal tab (only
  // Billing is role-gated), so the chip has no extra RBAC condition — if the
  // Portal tab ever gains a role gate, gate this the same way.
  const portalStatus = usePortalStatus(isValidId ? householdId : undefined);
  
  // Initialize tab from URL query parameter
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);
  
  // Initialize edited name when household loads
  useEffect(() => {
    if (currentHouseholdDetail?.name) {
      setEditedName(currentHouseholdDetail.name);
    }
  }, [currentHouseholdDetail?.name]);
  
  useEffect(() => {
    if (isValidId) {
      fetchHouseholdDetail(householdId!);
      // Silently fetch flags - they may not exist and that's okay
      fetchFlags(householdId!).catch(() => {});

      // Fetch booking count for stat card
      useDaycareStore.getState().fetchBookings({ household_id: householdId! })
        .then(() => {
          const bookings = useDaycareStore.getState().bookings;
          setHouseholdBookingCount(bookings.filter(b => b.household_id === householdId).length);
        })
        .catch(() => {});

      // Fetch membership/packages for this household
      fetchCustomerPackages(householdId!).catch(() => {});

      // Fetch outstanding balance from billing
      useBillingStore.getState().fetchHouseholdBalance(householdId)
        .then(setOutstandingBalance)
        .catch(() => setOutstandingBalance(null));
    }
  }, [householdId, isValidId]);
  
  // Handle name edit save
  const handleSaveName = async () => {
    if (!currentHouseholdDetail || !editedName.trim() || editedName === currentHouseholdDetail.name) {
      setIsEditingName(false);
      return;
    }
    
    setIsSavingName(true);
    try {
      await updateHousehold(currentHouseholdDetail.id, { name: editedName.trim() });
      setIsEditingName(false);
      // Refresh household data to get updated values
      await fetchHouseholdDetail(currentHouseholdDetail.id);
    } catch (error) {
      console.error('Failed to update household name:', error);
      // Reset to original name on error
      setEditedName(currentHouseholdDetail.name);
    } finally {
      setIsSavingName(false);
    }
  };
  
  // Handle name edit cancel
  const handleCancelEdit = () => {
    if (currentHouseholdDetail) {
      setEditedName(currentHouseholdDetail.name);
    }
    setIsEditingName(false);
  };
  
  // Handle Enter key to save, Escape to cancel
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };
  
  // Handle delete confirmation
  const handleDeleteConfirm = () => {
    setShowDeleteConfirm(true);
  };
  
  // Handle delete cancellation
  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };
  
  // Handle delete action
  const handleDelete = async () => {
    if (!currentHouseholdDetail) {
      return;
    }
    
    setIsDeleting(true);
    try {
      await deleteHousehold(currentHouseholdDetail.id);
      toast.success(`Household "${currentHouseholdDetail.name}" deleted successfully`);
      navigate('/customers');
    } catch (error: any) {
      console.error('Failed to delete household:', error);
      toast.error(error.message || 'Failed to delete household');
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };
  
  // NOW WE CAN HAVE CONDITIONAL RETURNS
  
  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  
  // Show error if ID is invalid or household not found
  if (!isValidId || (!currentHouseholdDetail && !isLoading)) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <Warning className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="font-semibold text-slate-900 mb-2">
              {!isValidId ? 'Invalid household ID' : 'Household not found'}
            </h3>
            <p className="text-slate-600 mb-4">
              {!isValidId 
                ? 'The household ID provided is not valid. Please check the URL and try again.'
                : 'This household doesn\'t exist or you don\'t have permission to view it.'
              }
            </p>
            {error && (
              <p className="text-sm text-slate-500 mb-4 font-mono bg-slate-100 px-3 py-2 rounded inline-block">
                Error: {error}
              </p>
            )}
            {householdId && (
              <p className="text-xs text-slate-400 mb-4 font-mono">
                Household ID: {householdId}
              </p>
            )}
            <Button onClick={() => navigate('/customers')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Customers
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Extract data from currentHouseholdDetail (flat structure from store)
  const household = currentHouseholdDetail!;
  const contacts = household.contacts || [];
  const pets = household.pets || [];
  const documents = household.documents || [];
  
  // Calculate summary data
  const summary = {
    totalPets: pets.length,
    activePets: pets.filter(p => p.active).length,
    totalDocuments: documents.length,
    expiredDocuments: documents.filter(d => d.expiry_date && new Date(d.expiry_date) < new Date()).length,
    totalBookings: householdBookingCount,
    outstandingBalance,
  };
  
  const primaryContact = contacts.find(c => c.is_primary) || contacts[0];
  
  // Get household-wide active flags (pet_id is null)
  const householdFlags = flags.filter(f => f.is_active && !f.pet_id);
  
  // Helper function to get flag icon
  const getFlagIcon = (key: string) => {
    switch (key) {
      case 'vip': return Star;
      case 'behaviour_caution': return Warning;
      case 'medical_caution': return ShieldWarning;
      case 'payment_hold': return Prohibit;
      case 'transport_instructions': return Truck;
      case 'grooming_restrictions': return Scissors;
      case 'overnight_restrictions': return House;
      default: return Flag;
    }
  };
  
  // Helper function to get severity colors
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'warn': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'block': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };
  
  // Helper function to get flag label
  const getFlagLabel = (key: string) => {
    return key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };
  
  // Define quick action buttons based on enabled modules
  const quickActions = [
    { id: 'daycare', label: 'Book Daycare', enabled: globalEnabledModules.includes('daycare') },
    { id: 'grooming', label: 'Book Grooming', enabled: globalEnabledModules.includes('grooming') },
    { id: 'transport', label: 'Create Transport', enabled: globalEnabledModules.includes('transport') },
    { id: 'overnights', label: 'Book Overnight', enabled: globalEnabledModules.includes('overnights') },
  ].filter(action => action.enabled);
  
  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header — wraps on phones so actions drop below the name instead of
          pushing the page wider than the screen */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2 sm:gap-4 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/customers')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2 group">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="text-3xl font-bold border-b-2 border-blue-500 outline-none bg-transparent px-1"
                    style={{ width: `${Math.max(editedName.length * 20, 200)}px` }}
                    autoFocus
                    disabled={isSavingName}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleSaveName}
                    disabled={isSavingName || !editedName.trim()}
                    className="h-8 w-8 p-0"
                  >
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelEdit}
                    disabled={isSavingName}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              ) : (
                <>
                  <h1 className="text-2xl sm:text-3xl font-bold break-words">{household.name}</h1>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditingName(true)}
                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 hover:bg-slate-100"
                  >
                    <PencilSimple className="h-4 w-4 text-slate-500" />
                  </Button>
                </>
              )}
              {household.vip && (
                <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
              )}
              <Badge variant={household.status === 'active' ? 'default' : 'secondary'}>
                {household.status}
              </Badge>
              {portalStatus && (
                <PortalStatusChip status={portalStatus} onClick={() => setActiveTab('portal')} />
              )}
            </div>
            
            {primaryContact && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                <div className="flex items-center gap-1 min-w-0">
                  <EnvelopeSimple className="h-4 w-4 shrink-0" />
                  <ContactLink
                    kind="email"
                    value={primaryContact.email}
                    contactName={`${primaryContact.first_name} ${primaryContact.last_name}`}
                    className="truncate"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <Phone className="h-4 w-4 shrink-0" />
                  <ContactLink
                    kind="phone"
                    value={primaryContact.phone}
                    contactName={`${primaryContact.first_name} ${primaryContact.last_name}`}
                  />
                </div>
              </div>
            )}
            
            {/* Status Flags */}
            <div className="flex flex-wrap gap-2 mt-3">
              {household.payment_hold && (
                <Badge variant="destructive">
                  <Prohibit className="h-3 w-3 mr-1" />
                  Payment Hold
                </Badge>
              )}
              {householdFlags.map(flag => {
                const IconComponent = getFlagIcon(flag.flag_key);
                return (
                  <Badge 
                    key={flag.id} 
                    className={`${getSeverityColor(flag.severity)} border`}
                    title={flag.reason || undefined}
                  >
                    <IconComponent className="h-3 w-3 mr-1" />
                    {getFlagLabel(flag.flag_key)}
                  </Badge>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <ChatTeardrop className="h-4 w-4 mr-2" />
            Send Message
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Booking
          </Button>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Total Pets</p>
                <p className="text-2xl font-bold">{summary.totalPets}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {summary.activePets} active
                </p>
              </div>
              <Dog className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Documents</p>
                <p className="text-2xl font-bold">{summary.totalDocuments}</p>
                {summary.expiredDocuments > 0 && (
                  <p className="text-xs text-red-600 mt-1">
                    {summary.expiredDocuments} expired
                  </p>
                )}
              </div>
              <FileText className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Bookings</p>
                <p className="text-2xl font-bold">{summary.totalBookings}</p>
              </div>
              <CalendarBlank className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Balance</p>
                <p className="text-2xl font-bold">
                  {summary.outstandingBalance === null ? (
                    <span title="Balance unavailable — billing didn't respond">—</span>
                  ) : (
                    formatCurrency(summary.outstandingBalance)
                  )}
                </p>
              </div>
              <Receipt className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {quickActions.map(action => (
              <Button key={action.id} variant="outline" className="justify-start h-auto py-3">
                <Plus className="h-4 w-4 mr-2" />
                {action.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="pets">Pets</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="bookings">Bookings & Visits</TabsTrigger>
          {user?.role !== 'staff' && (
            <TabsTrigger value="billing">Billing</TabsTrigger>
          )}
          <TabsTrigger value="notes">Notes & Flags</TabsTrigger>
          <TabsTrigger value="portal">Portal</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview">
          <OverviewTab household={currentHouseholdDetail} />
        </TabsContent>
        
        <TabsContent value="contacts">
          <ContactsTab household={currentHouseholdDetail} />
        </TabsContent>
        
        <TabsContent value="pets">
          <PetsTab
            household={currentHouseholdDetail}
            memberships={customerPackages.filter(p => p.customer_id === householdId && p.status === 'active')}
          />
        </TabsContent>
        
        <TabsContent value="documents">
          <DocumentManager householdId={household.id} showHouseholdDocs={true} />
        </TabsContent>
        
        <TabsContent value="messages">
          <MessagesTab householdId={household.id} />
        </TabsContent>
        
        <TabsContent value="bookings">
          <BookingsTab householdId={household.id} />
        </TabsContent>
        
        {user?.role !== 'staff' && (
          <TabsContent value="billing">
            <BillingTab householdId={household.id} />
          </TabsContent>
        )}
        
        <TabsContent value="notes">
          <NotesTab household={currentHouseholdDetail} />
        </TabsContent>

        <TabsContent value="portal">
          <PortalActivityTab householdId={currentHouseholdDetail.id} />
        </TabsContent>
      </Tabs>
      
      {/* Danger Zone */}
      {!showDeleteConfirm && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible actions that affect this household
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteConfirm}
            >
              <Trash className="h-4 w-4 mr-2" />
              Delete Household
            </Button>
          </CardContent>
        </Card>
      )}
      
      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <Card className="border-red-500">
          <CardContent className="py-12 text-center">
            <Trash className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="font-semibold text-slate-900 mb-2">
              Delete Household "{household.name}"?
            </h3>
            <p className="text-slate-600 mb-4">
              This will permanently delete this household and all associated data:
            </p>
            <ul className="text-sm text-slate-600 mb-6 space-y-1">
              <li>• {contacts.length} contact(s)</li>
              <li>• {pets.length} pet(s)</li>
              <li>• {documents.length} document(s)</li>
              <li>• All notes and flags</li>
              <li>• All activity history</li>
            </ul>
            <p className="text-red-600 font-semibold mb-6">
              This action cannot be undone!
            </p>
            <div className="flex justify-center gap-4">
              <Button
                size="sm"
                variant="outline"
                onClick={handleDeleteCancel}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete Permanently'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
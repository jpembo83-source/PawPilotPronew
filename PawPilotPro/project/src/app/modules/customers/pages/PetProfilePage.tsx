import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useCustomerStore } from '../store';
import { 
  ArrowLeft, 
  Dog,
  AlertCircle,
  FileWarning,
  Activity,
  Syringe,
  Flag as FlagIcon,
  Camera,
  Loader2,
  X
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import {
  Card,
  CardContent,
} from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';

// Import tab components
import { PetOverviewTab } from '../components/pet-profile/PetOverviewTab';
import { DocumentManager } from '../components/DocumentManager';
import { PetCareProfileTab } from '../components/pet-profile/PetCareProfileTab';
import { PetTimelineTab } from '../components/pet-profile/PetTimelineTab';
import { EditPetModal } from '../components/modals/EditPetModal';

export function PetProfilePage() {
  const { petId } = useParams<{ petId: string }>();
  const navigate = useNavigate();
  const { currentPetProfile, isLoading, fetchPetProfile, updatePet } = useCustomerStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [showEditModal, setShowEditModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  useEffect(() => {
    if (petId) {
      fetchPetProfile(petId);
    }
  }, [petId]);
  
  // Update preview when pet profile loads
  useEffect(() => {
    if (currentPetProfile?.photo_url) {
      setPreviewUrl(currentPetProfile.photo_url);
    }
  }, [currentPetProfile?.photo_url]);
  
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    
    setUploading(true);
    
    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('petId', currentPetProfile!.id);
      
      // Upload to backend
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/pet-photo-upload/upload`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: formData,
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload photo');
      }
      
      const data = await response.json();
      
      // Update local preview (backend returns 'url' not 'photoUrl')
      setPreviewUrl(data.url);
      
      // Update pet profile
      await updatePet(currentPetProfile!.id, { photo_url: data.url });
      await fetchPetProfile(currentPetProfile!.id);
      
    } catch (error: any) {
      console.error('Failed to upload photo:', error);
      alert(`Failed to upload photo: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };
  
  const handleRemovePhoto = async () => {
    if (!confirm('Are you sure you want to remove this photo?')) return;
    
    setUploading(true);
    
    try {
      // Update pet to remove photo
      await updatePet(currentPetProfile!.id, { photo_url: null });
      setPreviewUrl(null);
      await fetchPetProfile(currentPetProfile!.id);
    } catch (error: any) {
      console.error('Failed to remove photo:', error);
      alert('Failed to remove photo');
    } finally {
      setUploading(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  
  if (!currentPetProfile) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="font-semibold text-slate-900 mb-2">Pet not found</h3>
            <p className="text-slate-600 mb-4">
              This pet doesn't exist or you don't have permission to view it
            </p>
            <Button onClick={() => navigate('/customers')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Customers
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // currentPetProfile is just the Pet object
  const pet = currentPetProfile;
  const flags: any[] = []; // TODO: Fetch flags from API
  const hasAlerts = flags.filter(f => !f.isResolved).length > 0 || !pet.active;
  
  // Mock summary data - TODO: Fetch from API
  const summary = {
    documentStatus: {
      valid: 0,
      expiring: 0,
      expired: 0,
    },
    recentVisits: 0,
    lastVisit: null as string | null,
  };
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/customers/${pet.household_id}?tab=pets`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          {/* Profile Picture with Upload */}
          <div className="relative group">
            <div className="relative w-32 h-32 rounded-full overflow-hidden bg-slate-100 border-4 border-white shadow-lg flex-shrink-0">
              {previewUrl ? (
                <>
                  <img
                    src={previewUrl}
                    alt={pet.name}
                    className="w-full h-full object-cover"
                  />
                  {/* Remove button */}
                  <button
                    onClick={handleRemovePhoto}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg opacity-0 group-hover:opacity-100"
                    disabled={uploading}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                  <Dog className="h-12 w-12" />
                </div>
              )}
              
              {uploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-white animate-spin" />
                </div>
              )}
              
              {/* Upload overlay on hover */}
              {!uploading && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <Camera className="h-8 w-8 mb-1" />
                  <span className="text-xs font-medium">
                    {previewUrl ? 'Change Photo' : 'Upload Photo'}
                  </span>
                </button>
              )}
            </div>
            
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
          
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{pet.name}</h1>
              <Badge variant={pet.active ? 'default' : 'destructive'}>
                {pet.active ? 'active' : 'inactive'}
              </Badge>
              {hasAlerts && (
                <AlertCircle className="h-6 w-6 text-red-500" />
              )}
            </div>
            
            <div className="flex items-center gap-4 text-sm text-slate-600">
              {pet.breed && <span className="font-medium">{pet.breed}</span>}
              {pet.breed && pet.sex && <span>•</span>}
              {pet.sex && <span className="capitalize">{pet.sex}</span>}
              {pet.date_of_birth && (
                <>
                  <span>•</span>
                  <span>
                    Born {new Date(pet.date_of_birth).toLocaleDateString('en-GB')}
                  </span>
                </>
              )}
            </div>
            
            <p className="text-sm text-slate-500 mt-2">
              <button
                className="text-primary hover:underline"
                onClick={() => navigate(`/customers/${pet.household_id}?tab=pets`)}
              >
                Back to Household
              </button>
            </p>
          </div>
        </div>
        
        <Button variant="outline" onClick={() => setShowEditModal(true)}>Edit Pet</Button>
      </div>
      
      {/* Alert Banner */}
      {hasAlerts && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 mb-2">Active Alerts</h3>
                <div className="space-y-2">
                  {!pet.active && (
                    <div className="text-sm text-red-700">
                      • Pet is inactive
                    </div>
                  )}
                  {flags.filter(f => !f.isResolved).map(flag => (
                    <div key={flag.id} className="text-sm text-red-700">
                      • {flag.title}
                      {flag.blocksCheckIn && ' (Blocks check-in)'}
                      {flag.blocksBooking && ' (Blocks booking)'}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Documents</p>
                <p className="text-2xl font-bold">{summary.documentStatus.valid + summary.documentStatus.expiring + summary.documentStatus.expired}</p>
                {summary.documentStatus.expired > 0 && (
                  <p className="text-xs text-red-600 mt-1">
                    {summary.documentStatus.expired} expired
                  </p>
                )}
              </div>
              <FileWarning className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Recent Visits</p>
                <p className="text-2xl font-bold">{summary.recentVisits}</p>
                {summary.lastVisit && (
                  <p className="text-xs text-slate-500 mt-1">
                    Last: {new Date(summary.lastVisit).toLocaleDateString('en-GB')}
                  </p>
                )}
              </div>
              <Activity className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Active Flags</p>
                <p className="text-2xl font-bold">{flags.filter(f => !f.isResolved).length}</p>
              </div>
              <FlagIcon className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Vaccinations</p>
                <p className="text-2xl font-bold">{summary.documentStatus.valid}</p>
                {summary.documentStatus.expiring > 0 && (
                  <p className="text-xs text-orange-600 mt-1">
                    {summary.documentStatus.expiring} expiring soon
                  </p>
                )}
              </div>
              <Syringe className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="care">Care Profile</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview">
          <PetOverviewTab pet={currentPetProfile} />
        </TabsContent>
        
        <TabsContent value="documents">
          <DocumentManager householdId={currentPetProfile.household_id} petId={currentPetProfile.id} showHouseholdDocs={true} />
        </TabsContent>
        
        <TabsContent value="care">
          <PetCareProfileTab pet={currentPetProfile} />
        </TabsContent>
        
        <TabsContent value="timeline">
          <PetTimelineTab pet={currentPetProfile} />
        </TabsContent>
      </Tabs>
      
      {/* Edit Pet Modal */}
      <EditPetModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        pet={pet}
        onPetUpdated={() => fetchPetProfile(pet.id)}
      />
    </div>
  );
}
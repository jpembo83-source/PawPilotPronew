import React, { useState, useRef } from 'react';
import { Pet } from '../../types';
import { Card, CardContent } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Camera, UploadSimple, X, CircleNotch } from '@phosphor-icons/react';
import { projectId, publicAnonKey } from '../../../../../../utils/supabase/info';

interface PetProfilePictureProps {
  pet: Pet;
  onUpdate: (photoUrl: string) => void;
}

export function PetProfilePicture({ pet, onUpdate }: PetProfilePictureProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(pet.photo_url || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }
    
    setUploading(true);
    
    try {
      // UploadSimple via backend (bypasses RLS)
      const formData = new FormData();
      formData.append('file', file);
      formData.append('petId', pet.id);
      
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
        throw new Error(error.error || 'Upload failed');
      }
      
      const data = await response.json();
      
      // Update preview
      setPreviewUrl(data.url);
      
      // Call parent update function
      onUpdate(data.url);
      
    } catch (error: any) {
      console.error('UploadSimple error:', error);
      alert(`Failed to upload photo: ${error.message}`);
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  const handleRemovePhoto = async () => {
    if (!confirm('Remove profile picture?')) return;
    
    setPreviewUrl(null);
    onUpdate('');
  };
  
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col items-center gap-4">
          {/* Photo Display */}
          <div className="relative w-48 h-48 rounded-full overflow-hidden bg-slate-100 border-4 border-white shadow-lg">
            {previewUrl ? (
              <>
                <img
                  src={previewUrl}
                  alt={pet.name}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={handleRemovePhoto}
                  className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                  disabled={uploading}
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                <Camera className="h-16 w-16 mb-2" />
                <p className="text-sm">No photo</p>
              </div>
            )}
            
            {uploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <CircleNotch className="h-8 w-8 text-white animate-spin" />
              </div>
            )}
          </div>
          
          {/* UploadSimple Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <CircleNotch className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <UploadSimple className="h-4 w-4 mr-2" />
                {previewUrl ? 'Change Photo' : 'Upload Photo'}
              </>
            )}
          </Button>
          
          <p className="text-xs text-slate-500 text-center">
            JPG, PNG or GIF (max 5MB)
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
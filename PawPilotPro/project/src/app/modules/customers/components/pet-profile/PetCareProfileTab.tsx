import React from 'react';
import { Pet } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { 
  Utensils, 
  Pill, 
  AlertTriangle, 
  Heart,
  AlertOctagon,
  FileText
} from 'lucide-react';
import { VaccinationManager } from './VaccinationManager';

interface PetCareProfileTabProps {
  pet: Pet;
}

export function PetCareProfileTab({ pet }: PetCareProfileTabProps) {
  if (!pet) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-slate-400">
          <p>No care profile information available</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Feeding */}
      {pet.feeding_instructions && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Utensils className="h-5 w-5" />
                <CardTitle>Feeding</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{pet.feeding_instructions}</p>
          </CardContent>
        </Card>
      )}
      
      {/* Allergies */}
      {pet.allergies && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-amber-900">Allergies</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-900 whitespace-pre-wrap">{pet.allergies}</p>
          </CardContent>
        </Card>
      )}
      
      {/* Medical Notes */}
      {pet.medical_notes && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertOctagon className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-blue-900">Medical Notes</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-blue-900 whitespace-pre-wrap">{pet.medical_notes}</p>
          </CardContent>
        </Card>
      )}
      
      {/* Behaviour Notes */}
      {pet.behaviour_notes && (
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" />
              <CardTitle className="text-purple-900">Behaviour Notes</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-purple-800 whitespace-pre-wrap">{pet.behaviour_notes}</p>
          </CardContent>
        </Card>
      )}
      
      {/* Vaccination Manager - Swiss standard vaccination checklist */}
      <VaccinationManager petId={pet.id} pet={pet} />
      
      {/* Empty State */}
      {!pet.feeding_instructions && !pet.allergies && !pet.medical_notes && !pet.behaviour_notes && (
        <Card>
          <CardContent className="py-12 text-center text-slate-400">
            <FileText className="h-12 w-12 mx-auto mb-2 text-slate-300" />
            <p>No care profile information available</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
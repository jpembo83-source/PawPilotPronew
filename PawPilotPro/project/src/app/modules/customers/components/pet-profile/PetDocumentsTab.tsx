import React from 'react';
import { Pet } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { Plus, FileText, DownloadSimple, Warning, CalendarBlank } from '@phosphor-icons/react';

interface PetDocumentsTabProps {
  pet: Pet;
}

export function PetDocumentsTab({ pet }: PetDocumentsTabProps) {
  // TODO: Fetch documents from API
  const documents: any[] = [];
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'valid': return 'default';
      case 'expiring_soon': return 'default';
      case 'expired': return 'destructive';
      default: return 'secondary';
    }
  };
  
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'valid': return 'Valid';
      case 'expiring_soon': return 'Expiring Soon';
      case 'expired': return 'Expired';
      default: return status;
    }
  };
  
  const groupedDocuments = documents.reduce((acc, doc) => {
    if (!acc[doc.documentType]) {
      acc[doc.documentType] = [];
    }
    acc[doc.documentType].push(doc);
    return acc;
  }, {} as Record<string, typeof documents>);
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Documents & Compliance</CardTitle>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FileText className="h-12 w-12 mx-auto mb-2 text-slate-300" />
              <p>No documents uploaded</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedDocuments).map(([type, docs]) => (
                <div key={type}>
                  <h3 className="font-semibold text-lg mb-3 capitalize">
                    {type.replace('_', ' ')}
                  </h3>
                  <div className="space-y-3">
                    {docs.map(doc => (
                      <div
                        key={doc.id}
                        className="flex items-start gap-4 p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <FileText className="h-10 w-10 text-slate-400" />
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{doc.documentName}</h4>
                            <Badge variant={getStatusColor(doc.status)}>
                              {getStatusLabel(doc.status)}
                            </Badge>
                          </div>
                          
                          <p className="text-sm text-slate-600 mb-2">{doc.fileName}</p>
                          
                          {doc.expiryDate && (
                            <div className="flex items-center gap-1 text-sm text-slate-600">
                              <CalendarBlank className="h-4 w-4" />
                              <span>
                                Expires: {new Date(doc.expiryDate).toLocaleDateString('en-GB', {
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric'
                                })}
                              </span>
                            </div>
                          )}
                          
                          {doc.notes && (
                            <p className="text-sm text-slate-500 mt-2">{doc.notes}</p>
                          )}
                          
                          <p className="text-xs text-slate-400 mt-2">
                            Uploaded on {new Date(doc.uploadedAt).toLocaleDateString('en-GB')} by {doc.uploadedBy}
                          </p>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm">
                            <DownloadSimple className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">Edit</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Expiry Alerts */}
      {documents.some(d => d.status === 'expired' || d.status === 'expiring_soon') && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Warning className="h-5 w-5 text-red-600" />
              <CardTitle className="text-red-900">Expiry Alerts</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {documents
                .filter(d => d.status === 'expired' || d.status === 'expiring_soon')
                .map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-3 bg-white rounded-lg">
                    <div>
                      <p className="font-medium text-red-900">{doc.documentName}</p>
                      <p className="text-sm text-red-700">
                        {doc.status === 'expired' ? 'Expired' : 'Expires soon'} on{' '}
                        {doc.expiryDate && new Date(doc.expiryDate).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      Upload New
                    </Button>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
// Incident Details Tab - Display full incident information

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import type { Incident } from '../types';

interface IncidentDetailsTabProps {
  incident: Incident;
  onUpdate: () => void;
}

export function IncidentDetailsTab({ incident, onUpdate }: IncidentDetailsTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Description & Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-2">Summary</h4>
            <p className="text-slate-900">{incident.summary}</p>
          </div>

          {incident.description && (
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-2">Detailed Description</h4>
              <p className="text-slate-900 whitespace-pre-wrap">{incident.description}</p>
            </div>
          )}

          {incident.immediate_actions && (
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-2">Immediate Actions Taken</h4>
              <p className="text-slate-900 whitespace-pre-wrap">{incident.immediate_actions}</p>
            </div>
          )}

          {incident.needs_follow_up && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm font-medium text-amber-900">⚠️ Requires Follow-up</p>
            </div>
          )}
        </CardContent>
      </Card>

      {incident.people && incident.people.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>People Involved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {incident.people.map((person) => (
                <div key={person.id} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium">{person.user_name}</p>
                    <p className="text-sm text-slate-600 capitalize">{person.role.replace('_', ' ')}</p>
                    {person.notes && (
                      <p className="text-sm text-slate-600 mt-1">{person.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {incident.status === 'closed' && (
        <Card>
          <CardHeader>
            <CardTitle>Closure Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {incident.root_cause && (
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">Root Cause</h4>
                <p className="text-slate-900">{incident.root_cause}</p>
              </div>
            )}

            {incident.outcome_summary && (
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">Outcome Summary</h4>
                <p className="text-slate-900 whitespace-pre-wrap">{incident.outcome_summary}</p>
              </div>
            )}

            {incident.preventative_action && (
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">Preventative Action</h4>
                <p className="text-slate-900 whitespace-pre-wrap">{incident.preventative_action}</p>
              </div>
            )}

            <div className="flex items-center gap-4 text-sm text-slate-600 pt-2 border-t">
              <span>Closed by {incident.closed_by_name}</span>
              <span>•</span>
              <span>{new Date(incident.closed_at!).toLocaleString('en-GB')}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {incident.attachments && incident.attachments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Attachments ({incident.attachments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {incident.attachments.map((attachment) => (
                <div key={attachment.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium">{attachment.file_name}</p>
                    <p className="text-sm text-slate-600">
                      {(attachment.file_size / 1024).toFixed(1)} KB • Uploaded by {attachment.uploaded_by_name}
                    </p>
                  </div>
                  <a
                    href={attachment.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-sm"
                  >
                    Download
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

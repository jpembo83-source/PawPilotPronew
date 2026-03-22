import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { AlertCircle, Dog, Calendar, MapPin } from 'lucide-react';
import type { MessageThread } from '../types';

interface ContextPanelProps {
  thread: MessageThread;
}

export function ContextPanel({ thread }: ContextPanelProps) {
  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Context info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs text-slate-500 mb-1">Household</p>
            <p className="text-sm font-medium">{thread.householdName}</p>
          </div>

          {thread.module && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Module</p>
              <Badge variant="secondary" className="text-xs">
                {thread.module}
              </Badge>
            </div>
          )}

          {thread.context.petId && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Related Pet</p>
              <div className="flex items-center gap-2">
                <Dog className="h-4 w-4 text-slate-400" />
                <span className="text-sm">{thread.context.petId}</span>
              </div>
            </div>
          )}

          {thread.context.bookingId && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Related Booking</p>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span className="text-sm">{thread.context.bookingId}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Thread properties */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Thread Properties</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs text-slate-500 mb-1">Priority</p>
            <Badge 
              variant="outline" 
              className={
                thread.priority === 'urgent' ? 'bg-red-50 text-red-700 border-red-200' :
                thread.priority === 'high' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                thread.priority === 'normal' ? 'bg-slate-50 text-slate-700 border-slate-200' :
                'bg-blue-50 text-blue-700 border-blue-200'
              }
            >
              {thread.priority}
            </Badge>
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-1">Status</p>
            <div className="space-y-1">
              {thread.isUnread && (
                <Badge variant="secondary" className="text-xs">Unread</Badge>
              )}
              {thread.awaitingResponse && (
                <Badge variant="secondary" className="text-xs bg-orange-50 text-orange-700">
                  Awaiting Response
                </Badge>
              )}
              {thread.slaBreached && (
                <Badge variant="secondary" className="text-xs bg-red-50 text-red-700">
                  SLA Breached
                </Badge>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-1">Created</p>
            <p className="text-sm">
              {new Date(thread.createdAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Alerts placeholder */}
      {thread.slaBreached && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900">SLA Breached</p>
                <p className="text-xs text-red-700 mt-1">
                  Response overdue. Please address urgently.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { MessageSquare, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../../context/AuthContext';

export function MessagingWidget() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  
  const canView = hasPermission('messaging', 'read');

  if (!canView) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-slate-600" />
              Messaging
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Customer communications
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Button
          variant="outline"
          className="w-full justify-between"
          onClick={() => navigate('/messages')}
        >
          <span className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Open Messages
          </span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Plus, MessageSquare } from 'lucide-react';

interface MessagesTabProps {
  householdId: string;
}

export function MessagesTab({ householdId }: MessagesTabProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Messages & Communications</CardTitle>
            <CardDescription>
              View message history and send new communications
            </CardDescription>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Send Message
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12 text-slate-400">
          <MessageSquare className="h-12 w-12 mx-auto mb-2 text-slate-300" />
          <p>Message history will appear here</p>
          <p className="text-sm mt-1">Integration with Communications module</p>
        </div>
      </CardContent>
    </Card>
  );
}

// View As Banner - MDC Operations Centre
// Persistent, non-dismissable banner when in View As mode

import { AlertTriangle, Eye, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useViewAs } from '../../context/ViewAsContext';

export function ViewAsBanner() {
  const viewAsContext = useViewAs();
  
  // Safety check - if context is loading or unavailable, don't render
  if (!viewAsContext || viewAsContext.isLoading) {
    return null;
  }
  
  const { isViewingAs, session, targetUser, endViewAs } = viewAsContext;

  if (!isViewingAs || !session || !targetUser) {
    return null;
  }

  return (
    <div className="bg-orange-500 text-white px-4 py-3 shadow-lg border-b-4 border-orange-600">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-orange-600 px-3 py-1 rounded">
            <Eye className="h-4 w-4" />
            <span className="text-sm font-semibold">VIEW AS MODE</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm">Viewing as:</span>
            <span className="font-semibold">{targetUser.name}</span>
            <Badge variant="secondary" className="capitalize bg-white text-orange-900">
              {targetUser.role}
            </Badge>
          </div>

          <div className="flex items-center gap-2 text-sm opacity-90">
            <AlertTriangle className="h-4 w-4" />
            <span>All actions are disabled</span>
          </div>
        </div>

        <Button
          onClick={endViewAs}
          size="sm"
          variant="secondary"
          className="bg-white text-orange-900 hover:bg-orange-100"
        >
          <X className="h-4 w-4 mr-2" />
          Exit View As
        </Button>
      </div>
    </div>
  );
}
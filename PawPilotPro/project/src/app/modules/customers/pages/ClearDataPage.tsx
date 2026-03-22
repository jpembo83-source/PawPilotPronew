import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Trash2, AlertTriangle, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';

export function ClearDataPage() {
  const navigate = useNavigate();
  const [isClearing, setIsClearing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const handleClearData = async () => {
    if (!confirm('⚠️ Are you sure you want to delete ALL flags, notes, and timeline events? This cannot be undone!')) {
      return;
    }
    
    if (!confirm('This will permanently delete ALL flags, notes, and activities across ALL households. Type YES to confirm.')) {
      return;
    }
    
    setIsClearing(true);
    setError(null);
    setResult(null);
    
    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/clear-timeline-data`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-User-Token': token || '',
          },
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to clear data');
      }
      
      const data = await response.json();
      setResult(data);
      
    } catch (err: any) {
      console.error('Failed to clear data:', err);
      setError(err.message || 'Failed to clear data');
    } finally {
      setIsClearing(false);
    }
  };
  
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Card className="border-red-200">
        <CardHeader className="bg-red-50">
          <CardTitle className="flex items-center gap-2 text-red-900">
            <AlertTriangle className="h-5 w-5" />
            Clear Timeline Data
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-900 font-medium mb-2">
                ⚠️ Warning: This action is irreversible!
              </p>
              <p className="text-sm text-amber-800">
                This will permanently delete:
              </p>
              <ul className="text-sm text-amber-800 list-disc list-inside mt-2 space-y-1">
                <li>All flags (VIP, Behaviour Caution, Payment Hold, etc.)</li>
                <li>All notes (across all households and pets)</li>
                <li>All activity/timeline events</li>
              </ul>
              <p className="text-sm text-amber-800 mt-3">
                Household and pet data will remain intact, but all historical timeline entries will be removed.
              </p>
            </div>
            
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-900 font-medium">Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            )}
            
            {result && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <p className="text-sm text-green-900 font-medium">Success!</p>
                </div>
                <p className="text-sm text-green-800">
                  Deleted {result.deleted?.flags || 0} flags, {result.deleted?.notes || 0} notes, and {result.deleted?.activities || 0} activities.
                </p>
              </div>
            )}
            
            <div className="flex items-center gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => navigate('/customers')}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleClearData}
                disabled={isClearing}
              >
                {isClearing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All Timeline Data
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

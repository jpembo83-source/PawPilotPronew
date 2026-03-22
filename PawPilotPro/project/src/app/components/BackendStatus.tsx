// Backend Status Indicator - MDC Operations Centre
// Shows whether the backend is deployed and responding

import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

export function BackendStatus() {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkBackendStatus();
  }, []);

  const checkBackendStatus = async () => {
    setStatus('checking');
    setError(null);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/health`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          signal: AbortSignal.timeout(5000),
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'ok') {
          setStatus('online');
        } else {
          setStatus('offline');
          setError('Health check returned unexpected response');
        }
      } else {
        setStatus('offline');
        setError(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      setStatus('offline');
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unknown error');
      }
    }
  };

  if (status === 'checking') {
    return (
      <Alert>
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertTitle>Checking Backend Status...</AlertTitle>
        <AlertDescription>
          Verifying connection to Supabase Edge Functions
        </AlertDescription>
      </Alert>
    );
  }

  if (status === 'online') {
    return (
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-900">Backend Online</AlertTitle>
        <AlertDescription className="text-green-700">
          All backend services are operational and ready.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="border-orange-200 bg-orange-50">
      <XCircle className="h-4 w-4 text-orange-600" />
      <AlertTitle className="text-orange-900">Backend Not Deployed</AlertTitle>
      <AlertDescription className="text-orange-700">
        <p className="mb-2">
          The Supabase Edge Functions backend is not responding. Some features (View As, Messaging, etc.) won't work until the backend is deployed.
        </p>
        <p className="font-medium mb-2">To deploy the backend:</p>
        <ol className="list-decimal ml-4 space-y-1 text-sm">
          <li>Click the <strong>Deploy</strong> or <strong>Publish</strong> button in Figma Make</li>
          <li>Wait for deployment to complete (1-2 minutes)</li>
          <li>Refresh this page to verify backend is online</li>
        </ol>
        <p className="text-xs mt-2 text-muted-foreground">
          Error: {error || 'Failed to connect to backend'}
        </p>
        <button 
          onClick={checkBackendStatus}
          className="mt-3 text-sm underline text-orange-800 hover:text-orange-900"
        >
          Retry Connection
        </button>
      </AlertDescription>
    </Alert>
  );
}
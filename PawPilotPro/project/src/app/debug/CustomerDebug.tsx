// Customer Debug Tool
// Diagnostic tool to check backend data and troubleshoot visibility issues

import React, { useState } from 'react';
import { ArrowClockwise, Warning, CheckCircle, Database, UsersThree } from '@phosphor-icons/react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { supabase } from '../../utils/supabase/client';

export function CustomerDebug() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostics = async () => {
    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      // Get auth session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        setError('Not authenticated. Please log in first.');
        setIsLoading(false);
        return;
      }

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-User-Token': `Bearer ${session.access_token}`,
      };

      const baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23`;

      // Run multiple diagnostic checks
      const diagnostics: any = {
        auth: {
          userId: session.user.id,
          email: session.user.email,
          tenantId: session.user.user_metadata?.tenant_id || session.user.id,
        },
        timestamp: new Date().toISOString(),
      };

      // 1. Check debug endpoint
      console.log('[CustomerDebug] Fetching from debug endpoint...');
      const debugResponse = await fetch(`${baseUrl}/customers/debug/all-customers`, {
        headers,
      });

      if (debugResponse.ok) {
        diagnostics.debugEndpoint = await debugResponse.json();
      } else {
        const errorText = await debugResponse.text();
        diagnostics.debugEndpoint = { error: errorText, status: debugResponse.status };
      }

      // 2. Check households endpoint
      console.log('[CustomerDebug] Fetching from households endpoint...');
      const householdsResponse = await fetch(`${baseUrl}/customers/households`, {
        headers,
      });

      if (householdsResponse.ok) {
        const households = await householdsResponse.json();
        diagnostics.householdsEndpoint = {
          status: 'success',
          count: households.length,
          households: households,
        };
      } else {
        const errorText = await householdsResponse.text();
        diagnostics.householdsEndpoint = { error: errorText, status: householdsResponse.status };
      }

      // 3. Check debug-kv endpoint
      console.log('[CustomerDebug] Fetching from debug-kv endpoint...');
      const kvResponse = await fetch(`${baseUrl}/customers/debug-kv`, {
        headers,
      });

      if (kvResponse.ok) {
        diagnostics.kvEndpoint = await kvResponse.json();
      } else {
        const errorText = await kvResponse.text();
        diagnostics.kvEndpoint = { error: errorText, status: kvResponse.status };
      }

      console.log('[CustomerDebug] Diagnostics complete:', diagnostics);
      setResults(diagnostics);
    } catch (err: any) {
      console.error('[CustomerDebug] Error:', err);
      setError(err.message || 'Failed to run diagnostics');
    } finally {
      setIsLoading(false);
    }
  };

  const createTestHousehold = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        setError('Not authenticated. Please log in first.');
        setIsLoading(false);
        return;
      }

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-User-Token': `Bearer ${session.access_token}`,
      };

      const baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23`;

      // Create test household
      console.log('[CustomerDebug] Creating test household...');
      const response = await fetch(`${baseUrl}/customers/households`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'Test Household',
          status: 'active',
          vip: false,
          payment_hold: false,
        }),
      });

      if (response.ok) {
        const household = await response.json();
        alert(`Test household created successfully!\nID: ${household.id}\nName: ${household.name}`);
        // Re-run diagnostics
        await runDiagnostics();
      } else {
        const errorText = await response.text();
        setError(`Failed to create test household: ${errorText}`);
      }
    } catch (err: any) {
      console.error('[CustomerDebug] Error:', err);
      setError(err.message || 'Failed to create test household');
    } finally {
      setIsLoading(false);
    }
  };

  const clearAllData = async () => {
    if (!confirm('⚠️ WARNING: This will delete ALL customer data (households, contacts, pets, documents, etc.) from the KV store.\n\nThis action cannot be undone.\n\nAre you sure you want to continue?')) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        setError('Not authenticated. Please log in first.');
        setIsLoading(false);
        return;
      }

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-User-Token': `Bearer ${session.access_token}`,
      };

      const baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23`;

      // Call clear timeline endpoint (which clears flags, activities, notes)
      console.log('[CustomerDebug] Clearing timeline data...');
      await fetch(`${baseUrl}/customers/clear-timeline`, {
        method: 'POST',
        headers,
      });

      // Delete all customer data by prefix
      console.log('[CustomerDebug] Deleting all customer data...');
      const deleteResponse = await fetch(`${baseUrl}/customers/debug/delete-all`, {
        method: 'DELETE',
        headers,
      });

      if (deleteResponse.ok) {
        alert('✓ All customer data has been cleared successfully!');
        // Re-run diagnostics
        await runDiagnostics();
      } else {
        const errorText = await deleteResponse.text();
        setError(`Failed to clear data: ${errorText}`);
      }
    } catch (err: any) {
      console.error('[CustomerDebug] Error:', err);
      setError(err.message || 'Failed to clear data');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-6 h-6" />
              Customer Data Diagnostics
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Debug tool to check backend customer data and troubleshoot visibility issues
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={clearAllData}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Warning className="w-4 h-4" />
              Clear All Data
            </button>
            
            <button
              onClick={createTestHousehold}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <UsersThree className="w-4 h-4" />
              Create Test Household
            </button>
            
            <button
              onClick={runDiagnostics}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <ArrowClockwise className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Running...' : 'Run Diagnostics'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <Warning className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-900">Error</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {results && (
          <div className="space-y-4">
            {/* Auth Info */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-semibold text-blue-900">Authentication</h3>
              </div>
              <div className="text-xs text-blue-800 space-y-1">
                <div><strong>User ID:</strong> {results.auth.userId}</div>
                <div><strong>Email:</strong> {results.auth.email}</div>
                <div><strong>Tenant ID:</strong> {results.auth.tenantId}</div>
              </div>
            </div>

            {/* Debug Endpoint */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Debug Endpoint (/debug/all-customers)</h3>
              <pre className="text-xs bg-white p-3 rounded border border-slate-200 overflow-auto max-h-64">
                {JSON.stringify(results.debugEndpoint, null, 2)}
              </pre>
            </div>

            {/* Households Endpoint */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Households Endpoint (/households)</h3>
              <pre className="text-xs bg-white p-3 rounded border border-slate-200 overflow-auto max-h-64">
                {JSON.stringify(results.householdsEndpoint, null, 2)}
              </pre>
            </div>

            {/* KV Endpoint */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">KV Store Endpoint (/debug-kv)</h3>
              <pre className="text-xs bg-white p-3 rounded border border-slate-200 overflow-auto max-h-64">
                {JSON.stringify(results.kvEndpoint, null, 2)}
              </pre>
            </div>

            {/* Summary */}
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="text-sm font-semibold text-green-900 mb-2">Summary</h3>
              <div className="text-sm text-green-800 space-y-1">
                <div>
                  <strong>Total KV Items:</strong>{' '}
                  {results.debugEndpoint?.total_items || results.kvEndpoint?.total_items || 0}
                </div>
                <div>
                  <strong>Households Returned:</strong>{' '}
                  {results.householdsEndpoint?.count || 0}
                </div>
                <div>
                  <strong>Diagnosis:</strong>{' '}
                  {results.householdsEndpoint?.count > 0 ? (
                    <span className="text-green-700 font-medium">✓ Data is present and accessible</span>
                  ) : results.debugEndpoint?.total_items > 0 || results.kvEndpoint?.total_items > 0 ? (
                    <span className="text-orange-700 font-medium">⚠ Data exists in KV but not returning from /households endpoint</span>
                  ) : (
                    <span className="text-red-700 font-medium">✗ No customer data found in KV store</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {!results && !error && !isLoading && (
          <div className="text-center py-12 text-slate-500">
            <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Click "Run Diagnostics" to check customer data</p>
          </div>
        )}
      </div>
    </div>
  );
}

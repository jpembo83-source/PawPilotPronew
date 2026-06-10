// Debug page to inspect KV store
import React, { useState } from 'react';
import { projectId } from '../../../utils/supabase/info';
import { getAuthHeaders } from '../../utils/supabase/authHeaders';

export function KVDebug() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDebugData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/customers/debug/kv-keys`,
        {
          headers: await getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch debug data');
      }

      const result = await response.json();
      setData(result);
      console.log('[KV Debug] Data:', result);
    } catch (err: any) {
      console.error('[KV Debug] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/customers/debug/all-customers`,
        {
          headers: await getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch all customer data');
      }

      const result = await response.json();
      setData(result);
      console.log('[KV Debug All Customers] Data:', result);
    } catch (err: any) {
      console.error('[KV Debug All Customers] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">KV Store Debug</h1>
      
      <div className="flex gap-2 mb-4">
        <button
          onClick={fetchDebugData}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Fetch Summary'}
        </button>
        
        <button
          onClick={fetchAllCustomers}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Fetch ALL Customer Data'}
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {error}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {/* Show summary if available */}
          {data.summary && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h2 className="font-bold text-lg mb-2">Summary</h2>
              <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto">
                {JSON.stringify(data.summary, null, 2)}
              </pre>
            </div>
          )}

          {/* Show all data if available (from all-customers endpoint) */}
          {data.all_data && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h2 className="font-bold text-lg mb-2">
                All Customer Data ({data.total_items} items for tenant: {data.tenant})
              </h2>
              <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto max-h-[600px]">
                {JSON.stringify(data.all_data, null, 2)}
              </pre>
            </div>
          )}

          {data.sample_households && data.sample_households.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h2 className="font-bold text-lg mb-2">Sample Households</h2>
              <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto">
                {JSON.stringify(data.sample_households, null, 2)}
              </pre>
            </div>
          )}

          {data.sample_contacts && data.sample_contacts.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h2 className="font-bold text-lg mb-2">Sample Contacts</h2>
              <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto">
                {JSON.stringify(data.sample_contacts, null, 2)}
              </pre>
            </div>
          )}

          {data.sample_pets && data.sample_pets.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h2 className="font-bold text-lg mb-2">Sample Pets</h2>
              <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto">
                {JSON.stringify(data.sample_pets, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

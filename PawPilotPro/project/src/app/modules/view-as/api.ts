// View As API - MDC Operations Centre

import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import type { ViewAsSession, ViewAsUser, ViewAsAuditLog } from './types';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/view-as`;

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${publicAnonKey}`,
};

export async function startViewAsSession(viewerUserId: string, viewAsUserId: string, reason?: string): Promise<{ session: ViewAsSession; target_user: ViewAsUser }> {
  try {
    const response = await fetch(`${BASE_URL}/start`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ viewer_user_id: viewerUserId, view_as_user_id: viewAsUserId, reason }),
      signal: AbortSignal.timeout(10000), // 10 second timeout for this critical operation
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to start View As session');
    }
    
    return response.json();
  } catch (err) {
    // If it's a fetch error (network failure, timeout, etc.)
    if (err instanceof TypeError && err.message === 'Failed to fetch') {
      throw new Error('Backend server is not available. Please ensure the backend is deployed.');
    }
    // If it's a timeout error
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new Error('Request timed out. The backend server may be slow or unavailable.');
    }
    // Re-throw other errors as-is
    throw err;
  }
}

export async function endViewAsSession(viewerUserId: string, sessionId: string): Promise<void> {
  try {
    const response = await fetch(`${BASE_URL}/end`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ viewer_user_id: viewerUserId, session_id: sessionId }),
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to end View As session');
    }
  } catch (err) {
    // If it's a fetch error (network failure, timeout, etc.)
    if (err instanceof TypeError && err.message === 'Failed to fetch') {
      throw new Error('Backend server is not available. Please ensure the backend is deployed.');
    }
    // If it's a timeout error
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new Error('Request timed out. The backend server may be slow or unavailable.');
    }
    // Re-throw other errors as-is
    throw err;
  }
}

export async function getActiveSession(viewerUserId: string): Promise<ViewAsSession | null> {
  try {
    const response = await fetch(`${BASE_URL}/active/${viewerUserId}`, { 
      headers,
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) {
      // If it's a 404 or similar, just return null (no active session)
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP ${response.status}: Failed to fetch active session`);
    }
    
    const data = await response.json();
    return data;
  } catch (err) {
    // Log the error but don't throw - this allows the app to continue
    // Network errors, timeouts, etc. should not block the app from loading
    console.debug('View As: Failed to fetch active session (this is normal if backend is not yet deployed):', err);
    return null;
  }
}

export async function validateAction(sessionId: string, actionType: string): Promise<{ allowed: boolean; reason?: string }> {
  const response = await fetch(`${BASE_URL}/validate-action`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ session_id: sessionId, action_type: actionType }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to validate action');
  }
  
  return response.json();
}

export async function getSessions(): Promise<ViewAsSession[]> {
  try {
    const response = await fetch(`${BASE_URL}/sessions`, { 
      headers,
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch sessions');
    }
    
    return response.json();
  } catch (err) {
    console.debug('View As: Failed to fetch sessions (backend may not be deployed):', err);
    return []; // Return empty array instead of throwing
  }
}

export async function getAuditLogs(): Promise<ViewAsAuditLog[]> {
  try {
    const response = await fetch(`${BASE_URL}/audit-logs`, { 
      headers,
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch audit logs');
    }
    
    return response.json();
  } catch (err) {
    console.debug('View As: Failed to fetch audit logs (backend may not be deployed):', err);
    return []; // Return empty array instead of throwing
  }
}

export async function seedData(): Promise<void> {
  try {
    const response = await fetch(`${BASE_URL}/seed`, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) {
      throw new Error('Failed to seed data');
    }
  } catch (err) {
    console.debug('View As: Failed to seed data (backend may not be deployed):', err);
    // Don't throw - just log the error
  }
}
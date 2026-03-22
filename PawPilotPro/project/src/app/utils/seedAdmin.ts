// Development utility to ensure an admin user exists
import { projectId } from '../../../utils/supabase/info';

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23`;

export async function ensureAdminUser() {
  try {
    console.log('[seedAdmin] Creating admin user via seed endpoint...');
    
    // Use the seed-admin endpoint which doesn't require authentication
    const response = await fetch(`${API_URL}/seed-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (response.ok) {
      const result = await response.json();
      console.log('[seedAdmin] Response:', result.message);
      return { 
        created: !result.alreadyExists, 
        email: result.email,
        alreadyExists: result.alreadyExists 
      };
    } else {
      const error = await response.text();
      console.error('[seedAdmin] Failed to seed admin:', error);
      throw new Error(error);
    }
  } catch (error) {
    console.error('[seedAdmin] Error ensuring admin user:', error);
    throw error;
  }
}

export const DEFAULT_ADMIN_CREDENTIALS = {
  email: 'admin@mdcoperations.com',
  password: 'Admin123!'
};
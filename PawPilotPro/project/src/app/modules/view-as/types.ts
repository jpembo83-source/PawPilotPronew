// View As Types - MDC Operations Centre

export interface ViewAsSession {
  id: string;
  viewer_user_id: string;
  viewer_user_name: string;
  viewer_role: string;
  view_as_user_id: string;
  view_as_user_name: string;
  view_as_user_role: string;
  started_at: string;
  ended_at?: string;
  reason?: string;
  ip_address?: string;
  is_active: boolean;
}

export interface ViewAsAuditLog {
  id: string;
  session_id: string;
  viewer_user_id: string;
  view_as_user_id: string;
  action: 'session_started' | 'session_ended' | 'action_blocked' | 'navigation';
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface ViewAsUser {
  id: string;
  name: string;
  email: string;
  role: string;
  locations: string[];
  permissions: string[];
  enabled_modules: string[];
}

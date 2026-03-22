/**
 * Safe API utilities for handling fetch responses
 * Prevents JSON parsing errors when responses aren't valid JSON
 */

export interface ApiError {
  message: string;
  status: number;
  statusText: string;
}

/**
 * Safely parse an error response, handling non-JSON responses
 */
export async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return data.error || data.message || `Request failed (${response.status})`;
    } else {
      const text = await response.text();
      return text.substring(0, 200) || `Request failed (${response.status})`;
    }
  } catch {
    return `Request failed (${response.status} ${response.statusText})`;
  }
}

/**
 * Safely parse a JSON response, with error handling for non-JSON responses
 */
export async function safeParseJson<T>(response: Response): Promise<T> {
  try {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      throw new Error('Response is not JSON');
    }
  } catch (e: any) {
    throw new Error(`Failed to parse response: ${e.message}`);
  }
}

/**
 * Wrapper for fetch that handles errors consistently
 */
export async function safeFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage);
  }
  
  return safeParseJson<T>(response);
}

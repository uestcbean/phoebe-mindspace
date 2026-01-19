/**
 * Authentication utilities for token management
 */

const TOKEN_KEY = 'phoebe_auth_token';
const USER_KEY = 'phoebe_user';

/**
 * Save authentication data after login
 */
export function saveAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Get the current auth token
 */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Get the current user from storage
 */
export function getUser() {
  const userStr = localStorage.getItem(USER_KEY);
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch (e) {
      return null;
    }
  }
  return null;
}

/**
 * Clear authentication data (logout)
 */
export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated() {
  return !!getToken();
}

/**
 * Create headers with authentication token
 */
export function authHeaders(additionalHeaders = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...additionalHeaders,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Fetch with authentication
 */
export async function authFetch(url, options = {}) {
  const headers = authHeaders(options.headers || {});
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  // If 401, clear auth and reload
  if (response.status === 401) {
    clearAuth();
    window.location.reload();
  }
  
  return response;
}



const API_BASE_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3000').replace(/\/+$/, '');

// In-memory token storage (never stored in localStorage as per security specification)
let inMemoryToken = null;

export function setAuthToken(token) {
  inMemoryToken = token;
}

export function getAuthToken() {
  return inMemoryToken;
}

export function clearAuthToken() {
  inMemoryToken = null;
}

/**
 * Universal Fetch Wrapper for the Truth Tracker API
 *
 * @param {string} endpoint - Relative path (e.g. '/applications')
 * @param {RequestInit} [options={}] - Fetch options
 * @returns {Promise<any>} Parsed JSON response
 */
export async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (inMemoryToken) {
    headers['Authorization'] = `Bearer ${inMemoryToken}`;
  }

  const config = {
    ...options,
    headers,
  };

  const response = await fetch(url, config);

  // Handle empty or 204 No Content
  if (response.status === 204) {
    return null;
  }

  let data;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = (data && data.error) || (data && data.message) || response.statusText || 'API Request Failed';
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

const apiClient = {
  apiFetch,
  setAuthToken,
  getAuthToken,
  clearAuthToken,
  API_BASE_URL,
};

export default apiClient;

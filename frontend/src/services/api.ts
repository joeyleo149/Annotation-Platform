// Default to '/api' so Vite proxy catches relative routes
const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';

async function handleResponse(response: Response) {
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: response.ok ? text : 'The server encountered an error. Check the API logs for details.' };
    }
  }

  if (!response.ok) {
    const message = typeof data === 'object' && data !== null
      ? ('message' in data && typeof data.message === 'string' ? data.message
        : 'error' in data && typeof data.error === 'string' ? data.error
        : 'title' in data && typeof data.title === 'string' ? data.title
        : response.statusText)
      : response.statusText;
    const error = new Error(message);
    throw error;
  }

  return data;
}

function headers() {
  const token = localStorage.getItem('annotate_pro_token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

const api = {
  get: async (path: string) => {
    // Ensure path starts with a slash or joins cleanly
    const url = path.startsWith('/api') ? path : `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    
    const response = await fetch(url, {
      credentials: 'include',
      headers: headers(),
    });

    return { data: await handleResponse(response) };
  },

  post: async (path: string, body?: unknown) => {
    const url = path.startsWith('/api') ? path : `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: headers(),
      body: body ? JSON.stringify(body) : undefined,
    });

    return { data: await handleResponse(response) };
  },

  put: async (path: string, body?: unknown) => {
    const url = path.startsWith('/api') ? path : `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

    const response = await fetch(url, {
      method: 'PUT',
      credentials: 'include',
      headers: headers(),
      body: body ? JSON.stringify(body) : undefined,
    });

    return { data: await handleResponse(response) };
  },

  patch: async (path: string, body?: unknown) => {
    const url = path.startsWith('/api') ? path : `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const response = await fetch(url, { method: 'PATCH', credentials: 'include', headers: headers(), body: body ? JSON.stringify(body) : undefined });
    return { data: await handleResponse(response) };
  },
};

export default api;
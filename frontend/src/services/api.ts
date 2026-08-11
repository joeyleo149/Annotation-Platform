// Default to '/api' so Vite proxy catches relative routes
const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';

async function handleResponse(response: Response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(data?.message ?? response.statusText);
    throw error;
  }

  return data;
}

const api = {
  get: async (path: string) => {
    // Ensure path starts with a slash or joins cleanly
    const url = path.startsWith('/api') ? path : `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return { data: await handleResponse(response) };
  },

  post: async (path: string, body?: unknown) => {
    const url = path.startsWith('/api') ? path : `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    return { data: await handleResponse(response) };
  },
};

export default api;
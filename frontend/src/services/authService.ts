import api from './api';

export type Role = 'Admin' | 'Annotator';
export type AuthUser = { userId: number; email: string; role: Role };
type LoginResponse = AuthUser & { token: string };

const TOKEN_KEY = 'annotate_pro_token';

export async function login(username: string, password: string) {
  const { data } = await api.post('/auth/login', { username, password }) as { data: LoginResponse };
  localStorage.setItem(TOKEN_KEY, data.token);
  window.dispatchEvent(new Event('auth-changed'));
  return data;
}

export async function register(payload: {
  username: string; email: string; password: string; gender: string;
  nationality: string; dateOfBirth: string;
}) {
  return (await api.post('/auth/register', payload)).data;
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event('auth-changed'));
}

export function getToken() { return localStorage.getItem(TOKEN_KEY); }

export function getCurrentUser(): AuthUser | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp * 1000 <= Date.now()) { logout(); return null; }
    const role = payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ?? payload.role;
    const email = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ?? payload.email;
    const userId = Number(payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ?? payload.sub);
    return role === 'Admin' || role === 'Annotator' ? { userId, email, role } : null;
  } catch { logout(); return null; }
}

export function homeFor(role: Role) { return role === 'Admin' ? '/admin/upload' : '/annotator/videos'; }

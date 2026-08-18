// Per-tab auth token storage.
//
// We deliberately use sessionStorage (NOT localStorage) so that each browser
// tab keeps its own independent session. localStorage is shared across every
// tab/window of the same origin, which meant logging in as a second user in a
// new tab would overwrite the first tab's token and expose one user's data to
// the other. sessionStorage is scoped to a single tab, so two annotators (or an
// annotator and an admin) can be signed in side by side without colliding.
//
// Trade-off: closing a tab ends that tab's session (it will not persist across a
// full browser restart). This is intentional and also improves security.

const TOKEN_KEY = 'annotate_pro_token';

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

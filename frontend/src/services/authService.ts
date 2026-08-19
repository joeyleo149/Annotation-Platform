import api from './api';
import {
  clearToken,
  getToken,
  setToken,
} from './tokenStore';

export type Role =
  | 'Admin'
  | 'Annotator';

export type AuthUser = {
  userId: number;
  email: string;
  role: Role;
};

type LoginResponse =
  AuthUser & {
    token: string;
  };

export async function login(
  username: string,
  password: string,
) {
  const { data } =
    await api.post(
      '/auth/login',
      {
        username,
        password,
      },
    ) as {
      data: LoginResponse;
    };

  setToken(data.token);

  window.dispatchEvent(
    new Event('auth-changed'),
  );

  return data;
}

export async function register(
  payload: {
    username: string;
    email: string;
    password: string;
    gender: string;
    nationality: string;
    dateOfBirth: string;
  },
) {
  return (
    await api.post(
      '/auth/register',
      payload,
    )
  ).data;
}

export async function requestPasswordReset(
  email: string,
) {
  return (
    await api.post(
      '/auth/forgot-password',
      {
        email,
      },
    )
  ).data as {
    message: string;
  };
}

export async function resetPassword(
  email: string,
  otp: string,
  newPassword: string,
) {
  return (
    await api.post(
      '/auth/reset-password',
      {
        email,
        otp,
        newPassword,
      },
    )
  ).data as {
    message: string;
  };
}

export function logout() {
  clearToken();

  window.dispatchEvent(
    new Event('auth-changed'),
  );
}

export function getCurrentUser():
  AuthUser | null {
  const token =
    getToken();

  if (!token) {
    return null;
  }

  try {
    const tokenPart =
      token.split('.')[1];

    if (!tokenPart) {
      logout();
      return null;
    }

    const normalizedTokenPart =
      tokenPart
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const payload =
      JSON.parse(
        atob(normalizedTokenPart),
      );

    if (
      typeof payload.exp !== 'number' ||
      payload.exp * 1000 <= Date.now()
    ) {
      logout();
      return null;
    }

    const role =
      payload[
        'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'
      ] ??
      payload.role;

    const email =
      payload[
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'
      ] ??
      payload.email;

    const userId =
      Number(
        payload[
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'
        ] ??
        payload.sub,
      );

    if (
      role !== 'Admin' &&
      role !== 'Annotator'
    ) {
      logout();
      return null;
    }

    if (
      !Number.isInteger(userId) ||
      userId <= 0 ||
      typeof email !== 'string'
    ) {
      logout();
      return null;
    }

    return {
      userId,
      email,
      role,
    };
  } catch {
    logout();
    return null;
  }
}

export function homeFor(
  role: Role,
) {
  return role === 'Admin'
    ? '/admin/upload'
    : '/annotator/videos';
}

export interface UserProfileData {
  username: string;
  email: string;
  gender: string;
  nationality: string;
  dateOfBirth: string | null;
}

export async function fetchProfile():
  Promise<UserProfileData> {
  const response =
    await api.get(
      '/auth/profile',
    );

  return response.data as
    UserProfileData;
}

export async function updateProfile(
  payload:
    Partial<UserProfileData> & {
      password?: string;
    },
) {
  const response =
    await api.patch(
      '/auth/profile',
      payload,
    );

  return response.data;
}

export async function deleteAccount():
  Promise<void> {
  const user =
    getCurrentUser();

  if (!user) {
    throw new Error(
      'You are not signed in.',
    );
  }

  await api.delete(
    '/auth/account',
  );

  logout();
}
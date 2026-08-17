import {
  useState,
  type FormEvent,
} from 'react';

import {
  Eye,
  EyeOff,
  UserPlus,
} from 'lucide-react';

import api from '../services/api';

export default function AddAdminPage() {
  const [username, setUsername] =
    useState('');

  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [showPassword, setShowPassword] =
    useState(false);

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError('');
    setSuccess('');
    setBusy(true);

    try {
      const { data } = await api.post(
        '/admins',
        {
          username,
          email,
          password,
        },
      ) as {
        data: {
          message?: string;
        };
      };

      setSuccess(
        data.message ??
          'Administrator created successfully. Login credentials were sent by email.',
      );

      setUsername('');
      setEmail('');
      setPassword('');
      setShowPassword(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to create administrator.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="add-admin-view">
      <div className="add-admin-content">
        <div className="dashboard-heading add-admin-heading">
          <span
            className="dashboard-heading-icon"
            aria-hidden="true"
          >
            <UserPlus />
          </span>

          <div>
            <h1>Add Admin</h1>

            <p>
              Create another administrator and
              email their login credentials.
            </p>
          </div>
        </div>

        <form
          className="add-admin-form"
          onSubmit={submit}
        >
          <label className="auth-field">
            <span>Username</span>

            <input
              value={username}
              onChange={event =>
                setUsername(event.target.value)
              }
              minLength={3}
              autoComplete="username"
              placeholder="Enter admin username"
              required
            />
          </label>

          <label className="auth-field">
            <span>Email</span>

            <input
              type="email"
              value={email}
              onChange={event =>
                setEmail(event.target.value)
              }
              autoComplete="email"
              placeholder="Enter admin email"
              required
            />
          </label>

          <label className="auth-field add-admin-password">
            <span>Temporary password</span>

            <div className="password-field">
              <input
                type={
                  showPassword
                    ? 'text'
                    : 'password'
                }
                value={password}
                onChange={event =>
                  setPassword(event.target.value)
                }
                minLength={8}
                autoComplete="new-password"
                placeholder="Enter a strong password"
                required
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    visible => !visible,
                  )
                }
                aria-label={
                  showPassword
                    ? 'Hide password'
                    : 'Show password'
                }
              >
                {showPassword
                  ? <EyeOff />
                  : <Eye />}
              </button>
            </div>

            <small>
              At least 8 characters with uppercase,
              lowercase, number, and special character.
            </small>
          </label>

          {error ? (
            <p
              className="form-error add-admin-feedback"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          {success ? (
            <p
              className="form-success add-admin-feedback"
              role="status"
            >
              {success}
            </p>
          ) : null}

          <div className="add-admin-actions">
            <p>
              The username and temporary password
              will be sent to the email address
              above.
            </p>

            <button
              type="submit"
              className="primary-button"
              disabled={busy}
            >
              {busy
                ? 'Creating admin and sending email…'
                : 'Create Admin & Send Email'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { deleteAccount, getCurrentUser, logout, type Role } from '../services/authService';

const menus = {
  Admin: [
    ['Upload Video', '/admin/upload'],
    ['Uploaded Videos', '/admin/videos'],
    ['Add Admin', '/admin/add-admin']
  ],
  Annotator: [
    ['Discover', '/annotator/annotations'],
    ['My Annotations', '/annotator/videos'],
    ['Survey', '/survey']
  ]
} satisfies Record<Role, string[][]>;

const profilePaths: Record<Role, string> = {
  Admin: '/admin/profile',
  Annotator: '/annotator/profile'
};

export default function VerticalNav({ role }: { role: Role }) {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteAccount();
      navigate('/login', { replace: true });
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Unable to delete your account.');
      setDeleting(false);
    }
  };

  const email = user?.email ?? role;
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <aside className="side-nav">
      <div className="side-brand"><span>▷</span>Annotate Pro</div>
      <p className="role-label">{role}</p>
      <nav>
        {menus[role].map(([label, path]) => (
          <NavLink key={path} to={path}>{label}</NavLink>
        ))}
      </nav>

      <div className="account-tab" ref={accountRef}>
        {menuOpen && (
          <div className="account-menu" role="menu">
            <NavLink
              to={profilePaths[role]}
              className="account-menu-item"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
            >
              View profile
            </NavLink>
            <button
              type="button"
              className="account-menu-item"
              role="menuitem"
              onClick={() => { setMenuOpen(false); handleLogout(); }}
            >
              Log out
            </button>
            <button
              type="button"
              className="account-menu-item danger"
              role="menuitem"
              onClick={() => { setMenuOpen(false); setDeleteError(''); setConfirmingDelete(true); }}
            >
              Delete account
            </button>
          </div>
        )}

        <button
          type="button"
          className={`account-trigger${menuOpen ? ' active' : ''}`}
          onClick={() => setMenuOpen(open => !open)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <span className="account-avatar">{initials}</span>
          <span className="account-identity">
            <strong>{email}</strong>
            <small>{role}</small>
          </span>
          <span className="account-caret" aria-hidden="true">⌄</span>
        </button>
      </div>

      {confirmingDelete && (
        <div
          className="account-modal-overlay"
          role="presentation"
          onClick={() => { if (!deleting) setConfirmingDelete(false); }}
        >
          <div
            className="account-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-delete-title"
            onClick={event => event.stopPropagation()}
          >
            <h2 id="account-delete-title">Permanently delete your account?</h2>
            <p>
              This will permanently remove your account{user?.email ? <> (<strong>{user.email}</strong>)</> : null} and
              all of your data. This action cannot be undone.
            </p>
            {deleteError && <p className="account-modal-error" role="alert">{deleteError}</p>}
            <div className="account-modal-actions">
              <button
                type="button"
                className="account-modal-cancel"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="account-modal-confirm"
                onClick={() => void handleDeleteAccount()}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

import { NavLink, useNavigate } from 'react-router';
import { logout, type Role } from '../services/authService';

const menus = {
  Admin: [['Upload Video', '/admin/upload'], ['Uploaded Videos', '/admin/videos'], ['Profile', '/admin/profile'], ['Add Admin', '/admin/add-admin']],
  Annotator: [['Get a Video', '/annotator/videos'], ['My Annotations', '/annotator/annotations'], ['Profile', '/annotator/profile']]
} satisfies Record<Role, string[][]>;

export default function VerticalNav({ role }: { role: Role }) {
  const navigate = useNavigate();
  return <aside className="side-nav"><div className="side-brand"><span>▷</span>Annotate Pro</div><p className="role-label">{role}</p><nav>{menus[role].map(([label, path]) => <NavLink key={path} to={path}>{label}</NavLink>)}</nav><button onClick={() => { logout(); navigate('/login', { replace: true }); }}>Log out</button></aside>;
}

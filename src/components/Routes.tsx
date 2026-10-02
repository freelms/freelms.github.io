import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="p-8"><div className="skeleton h-8 w-1/2" /></div>;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return children;
}

export function AdminRoute({ children }: { children: JSX.Element }) {
  const { user, isAdmin, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="p-8"><div className="skeleton h-8 w-1/2" /></div>;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

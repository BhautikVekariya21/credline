import { Outlet } from 'react-router-dom';
import AdminSessionIntegrity from '../organisms/AdminSessionIntegrity';

export default function DashboardLayout() {
  return (
    <AdminSessionIntegrity>
      <div className="min-h-screen bg-surface-950 text-white font-sans">
        <Outlet />
      </div>
    </AdminSessionIntegrity>
  );
}

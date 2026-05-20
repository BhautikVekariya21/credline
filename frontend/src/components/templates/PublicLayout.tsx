import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import CursorTrail from '../../components/CursorTrail';

export default function PublicLayout() {
  const location = useLocation();

  useEffect(() => {
    const root = document.documentElement;
    const hadDarkTheme = root.classList.contains('dark');
    root.classList.remove('dark');

    return () => {
      if (hadDarkTheme) {
        root.classList.add('dark');
      }
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  return (
    <div className="public-site min-h-screen" data-theme="light">
      <CursorTrail />
      <Navbar />
      <main className="pt-16">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

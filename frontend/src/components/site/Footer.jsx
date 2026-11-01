import { Link } from "react-router-dom";

export const Footer = () => (
  <footer className="relative z-10 border-t border-slate-800 bg-[#0A0F1D] py-10" data-testid="site-footer">
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
      <div>
        <p className="font-cinzel text-lg font-bold text-amber-400">AAICHELADOO</p>
        <p>Homemade Maharashtrian sweets & namkin · Warje, Pune, Maharashtra</p>
      </div>
      <div className="flex items-center gap-4">
        <span>© 2026 AAICHELADOO</span>
        <Link to="/admin/login" className="text-slate-500 hover:text-amber-400" data-testid="footer-admin-link">Admin</Link>
      </div>
    </div>
  </footer>
);

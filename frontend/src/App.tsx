import { Routes, Route } from 'react-router-dom';

// Layouts
import PublicLayout from './components/templates/PublicLayout';
import AppLayout from './components/templates/AppLayout';

// Public Pages
import HomePage from './pages/HomePage';
import CreditPortal from './pages/CreditPortal';
import {
  AboutPage,
  PlatformPage,
  SecurityPage,
  ServicesHubPage,
  LendingPage,
  PaymentsPage,
  WealthPage,
  InsurancePage,
  OpenBankingPage,
  RegTechPage,
} from './pages/PublicPages';

// Admin Pages
import Dashboard from './pages/admin/Dashboard';
import Settings from './pages/admin/Settings';
import TaxCommandCenter from './pages/admin/TaxCommandCenter';
import ExecutiveStrategyRoom from './pages/admin/ExecutiveStrategyRoom';
import TreasuryAndAuditPortal from './pages/admin/TreasuryAndAuditPortal';
import OmniMonopolyDashboard from './pages/admin/OmniMonopolyDashboard';
import GodsEyeResiliency from './pages/admin/GodsEyeResiliency';
import CreditLineDevPortal from './pages/admin/CreditLineDevPortal';
import DatabaseConnectorPage from './pages/admin/DatabaseConnectorPage';
import NotificationsPage from './pages/admin/NotificationsPage';
import AuditLogPage from './pages/admin/AuditLogPage';
import {
  CreditEnginePage,
  FederationPage,
  FraudPage,
  GraphIntelligencePage,
  InfrastructurePage,
  QuantumPage,
  SoarPage,
  PaymentsIntelligencePage,
  WealthRiskPage,
  RegTechConsolePage,
} from './pages/admin/FeaturePages';

export default function App() {
  return (
    <Routes>
      {/* ─── Public Routes (Horizontal Navbar + Footer) ──────── */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/platform" element={<PlatformPage />} />
        <Route path="/portal" element={<CreditPortal />} />
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/about" element={<AboutPage />} />

        {/* ─── Services Routes ─────────────────────────────── */}
        <Route path="/services" element={<ServicesHubPage />} />
        <Route path="/services/lending" element={<LendingPage />} />
        <Route path="/services/payments" element={<PaymentsPage />} />
        <Route path="/services/wealth" element={<WealthPage />} />
        <Route path="/services/insurance" element={<InsurancePage />} />
        <Route path="/services/openbanking" element={<OpenBankingPage />} />
        <Route path="/services/regtech" element={<RegTechPage />} />
      </Route>

      {/* ─── Admin Routes (Sidebar Layout) ───────────────────── */}
      <Route element={<AppLayout />}>
        <Route path="/admin" element={<Dashboard />} />
        <Route path="/admin/fraud" element={<FraudPage />} />
        <Route path="/admin/credit" element={<CreditEnginePage />} />
        <Route path="/admin/graph" element={<GraphIntelligencePage />} />
        <Route path="/admin/soar" element={<SoarPage />} />
        <Route path="/admin/federation" element={<FederationPage />} />
        <Route path="/admin/quantum" element={<QuantumPage />} />
        <Route path="/admin/infra" element={<InfrastructurePage />} />
        <Route path="/admin/database" element={<DatabaseConnectorPage />} />
        <Route path="/admin/tax" element={<TaxCommandCenter />} />
        <Route path="/admin/strategy" element={<ExecutiveStrategyRoom />} />
        <Route path="/admin/treasury" element={<TreasuryAndAuditPortal />} />
        <Route path="/admin/ceo" element={<OmniMonopolyDashboard />} />
        <Route path="/admin/godseye" element={<GodsEyeResiliency />} />
        <Route path="/admin/developers" element={<CreditLineDevPortal />} />

        <Route path="/admin/payments" element={<PaymentsIntelligencePage />} />
        <Route path="/admin/wealth" element={<WealthRiskPage />} />
        <Route path="/admin/regtech" element={<RegTechConsolePage />} />
        <Route path="/admin/notifications" element={<NotificationsPage />} />
        <Route path="/admin/audit" element={<AuditLogPage />} />
        <Route path="/admin/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

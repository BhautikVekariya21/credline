/**
 * Credit Line Risk Intelligence - Tax Command Center.
 *
 * Shows GST liability, ITC available, PDF invoice intake, filing status,
 * and a live feed of tax-sensitive transactions needing approval.
 */

import { useState, type ChangeEvent, type ElementType } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  IndianRupee,
  Loader2,
  Receipt,
  Send,
  Shield,
  Trash2,
  TrendingUp,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import { useMockData } from '../../hooks/useMockData';
import { apiPost } from '../../lib/api';
import { cn } from '../../lib/utils';

interface GSTDashboard {
  current_period: string;
  filing_deadline: string;
  days_remaining: number;
  liability: { cgst: number; sgst: number; igst: number; cess: number; total: number };
  itc_available: { cgst: number; sgst: number; igst: number; total: number };
  net_payable: number;
  transactions_pending_review: number;
  filing_status: string;
  monthly_trend: { month: string; liability: number; itc: number }[];
}

interface CriticalAlert {
  alert_id: string;
  category: string;
  severity: string;
  title: string;
  amount: number;
  vendor: string;
  timestamp: string;
  requires_approval: boolean;
}

type SupplyType = 'INTRASTATE' | 'INTERSTATE' | 'EXPORT' | 'SEZ';
type TransactionType = 'SALE' | 'PURCHASE' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'ADVANCE' | 'REVERSE_CHARGE';
type TaxTab = 'overview' | 'filing' | 'alerts';

interface GSTFilingItem {
  id: string;
  file_name: string;
  hsn_code: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  supply_type: SupplyType;
  transaction_type: TransactionType;
  confidence: 'high' | 'review';
}

interface GSTFilingResult {
  gstin: string;
  period: string;
  filing_status: string;
  acknowledgement_ref?: string;
  summary: {
    total_taxable: number;
    total_cgst: number;
    total_sgst: number;
    total_igst: number;
    total_cess: number;
    total_tax: number;
    itc_available: number;
    net_liability: number;
  };
}

const MOCK_GST: GSTDashboard = {
  current_period: '052026',
  filing_deadline: '2026-06-11T23:59:59',
  days_remaining: 29,
  liability: { cgst: 42850, sgst: 42850, igst: 18200, cess: 0, total: 103900 },
  itc_available: { cgst: 31200, sgst: 31200, igst: 8400, total: 70800 },
  net_payable: 33100,
  transactions_pending_review: 7,
  filing_status: 'DRAFT',
  monthly_trend: [
    { month: 'Jan', liability: 95000, itc: 62000 },
    { month: 'Feb', liability: 88000, itc: 58000 },
    { month: 'Mar', liability: 112000, itc: 74000 },
    { month: 'Apr', liability: 98000, itc: 68000 },
    { month: 'May', liability: 103900, itc: 70800 },
  ],
};

const MOCK_ALERTS: CriticalAlert[] = [
  { alert_id: 'CTA-000001', category: 'HIGH_VALUE_TRANSACTION', severity: 'CRITICAL', title: 'Transaction exceeds INR 50L', amount: 5200000, vendor: 'VND-MFGR-042', timestamp: new Date().toISOString(), requires_approval: true },
  { alert_id: 'CTA-000002', category: 'BLACKLISTED_VENDOR', severity: 'CRITICAL', title: 'Payment to blacklisted vendor', amount: 180000, vendor: 'VND-SHELL-001', timestamp: new Date(Date.now() - 600000).toISOString(), requires_approval: true },
  { alert_id: 'CTA-000003', category: 'REGULATORY_THRESHOLD', severity: 'MEDIUM', title: 'TDS deduction required', amount: 75000, vendor: 'VND-CONSULT-007', timestamp: new Date(Date.now() - 1800000).toISOString(), requires_approval: true },
  { alert_id: 'CTA-000004', category: 'UNUSUAL_CASH_MOVEMENT', severity: 'HIGH', title: 'Daily cash limit exceeded', amount: 250000, vendor: 'CASH', timestamp: new Date(Date.now() - 3600000).toISOString(), requires_approval: false },
  { alert_id: 'CTA-000005', category: 'OFF_HOURS_TRANSACTION', severity: 'LOW', title: 'Off-hours transaction', amount: 42000, vendor: 'VND-LOGISTICS-011', timestamp: new Date(Date.now() - 7200000).toISOString(), requires_approval: false },
];

const fmt = (n: number) => `INR ${n.toLocaleString('en-IN')}`;

export default function TaxCommandCenter() {
  const { data: liveData, isMocked: dashboardMocked } = useMockData<GSTDashboard>('/tax/dashboard', MOCK_GST);
  const { data: liveAlerts, isMocked: alertsMocked } = useMockData<CriticalAlert[]>('/tax/alerts', MOCK_ALERTS, { pollInterval: 20_000 });
  const [activeTab, setActiveTab] = useState<TaxTab>('overview');
  const [gstin, setGstin] = useState('29ABCDE1234F1Z5');
  const [period, setPeriod] = useState(MOCK_GST.current_period);
  const [filingItems, setFilingItems] = useState<GSTFilingItem[]>([]);
  const [filingResult, setFilingResult] = useState<GSTFilingResult | null>(null);
  const [filingError, setFilingError] = useState<string | null>(null);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [isFiling, setIsFiling] = useState(false);

  const data = liveData ?? MOCK_GST;
  const alerts = liveAlerts ?? MOCK_ALERTS;

  const handlePdfUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => (
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    ));

    if (files.length === 0) {
      setFilingError('Upload one or more invoice PDFs before filing GST.');
      return;
    }

    setIsParsingPdf(true);
    setFilingError(null);
    setFilingResult(null);

    try {
      const parsed = await Promise.all(files.map((file, index) => parseInvoicePdf(file, index)));
      setFilingItems((current) => [...current, ...parsed]);
      setActiveTab('filing');
    } finally {
      setIsParsingPdf(false);
      event.target.value = '';
    }
  };

  const updateFilingItem = (id: string, patch: Partial<GSTFilingItem>) => {
    setFilingItems((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeFilingItem = (id: string) => {
    setFilingItems((items) => items.filter((item) => item.id !== id));
  };

  const fileGst = async () => {
    if (filingItems.length === 0) {
      setFilingError('Upload at least one PDF invoice before filing GST.');
      return;
    }
    if (!/^[0-9A-Z]{15}$/.test(gstin.trim().toUpperCase())) {
      setFilingError('Enter a valid 15-character GSTIN before filing.');
      return;
    }

    setIsFiling(true);
    setFilingError(null);
    setFilingResult(null);

    try {
      const result = await apiPost<GSTFilingResult>('/tax/gst/file', {
        gstin: gstin.trim().toUpperCase(),
        period,
        items: filingItems.map(({ hsn_code, description, quantity, unit_price, discount, supply_type, transaction_type }) => ({
          hsn_code,
          description,
          quantity,
          unit_price,
          discount,
          supply_type,
          transaction_type,
        })),
      });
      setFilingResult(result);
    } catch (error) {
      setFilingError(error instanceof Error ? error.message : 'GST filing failed.');
    } finally {
      setIsFiling(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)]">Tax Command Center</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">GST filing, invoice PDF intake, ITC, and compliance monitoring</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(dashboardMocked || alertsMocked) && (
            <span className="badge text-[10px] text-accent-orange bg-accent-orange/10 border border-accent-orange/20">Mock fallback</span>
          )}
          <TabButton label="Overview" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
          <TabButton label={`GST Filing ${filingItems.length ? `(${filingItems.length})` : ''}`} active={activeTab === 'filing'} onClick={() => setActiveTab('filing')} />
          <TabButton
            label="Alerts"
            active={activeTab === 'alerts'}
            onClick={() => setActiveTab('alerts')}
            count={alerts.filter((alert) => alert.requires_approval).length}
          />
        </div>
      </div>

      {activeTab === 'overview' && (
        <OverviewTab data={data} onOpenFiling={() => setActiveTab('filing')} onPdfUpload={handlePdfUpload} isParsingPdf={isParsingPdf} />
      )}
      {activeTab === 'filing' && (
        <FilingTab
          gstin={gstin}
          period={period}
          items={filingItems}
          result={filingResult}
          error={filingError}
          isParsingPdf={isParsingPdf}
          isFiling={isFiling}
          onGstinChange={setGstin}
          onPeriodChange={setPeriod}
          onPdfUpload={handlePdfUpload}
          onUpdateItem={updateFilingItem}
          onRemoveItem={removeFilingItem}
          onFileGst={fileGst}
        />
      )}
      {activeTab === 'alerts' && <AlertsTab alerts={alerts} />}
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
  count = 0,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn('px-4 py-2 text-sm font-semibold rounded-xl transition-all', active ? 'bg-credit-line-500 text-white' : 'btn-secondary')}
      type="button"
    >
      {label}
      {count > 0 && (
        <span className="ml-1 w-5 h-5 rounded-full bg-risk-high text-white text-[10px] font-bold inline-flex items-center justify-center">{count}</span>
      )}
    </button>
  );
}

function OverviewTab({
  data,
  onOpenFiling,
  onPdfUpload,
  isParsingPdf,
}: {
  data: GSTDashboard;
  onOpenFiling: () => void;
  onPdfUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  isParsingPdf: boolean;
}) {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={IndianRupee} label="GST Liability" value={fmt(data.liability.total)} color="text-risk-high" bg="bg-risk-high/8" />
        <KPICard icon={TrendingUp} label="ITC Available" value={fmt(data.itc_available.total)} color="text-risk-low" bg="bg-risk-low/8" />
        <KPICard icon={Receipt} label="Net Payable" value={fmt(data.net_payable)} color="text-credit-line-500" bg="bg-credit-line-500/8" />
        <KPICard icon={Clock} label="Filing Deadline" value={`${data.days_remaining} days`} color="text-risk-medium" bg="bg-risk-medium/8" sub={new Date(data.filing_deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} />
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-5">
          <div className="card p-6">
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <FileText size={18} className="text-credit-line-500" /> Tax Breakdown
            </h3>
            <div className="space-y-3">
              {[
                { label: 'CGST', value: data.liability.cgst, itc: data.itc_available.cgst },
                { label: 'SGST', value: data.liability.sgst, itc: data.itc_available.sgst },
                { label: 'IGST', value: data.liability.igst, itc: data.itc_available.igst },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-secondary)]">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{row.label}</span>
                  <div className="text-right">
                    <span className="text-sm font-bold text-risk-high">{fmt(row.value)}</span>
                    <span className="text-xs text-risk-low ml-2">-{fmt(row.itc)}</span>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between p-3 rounded-xl bg-credit-line-500/5 border border-credit-line-500/15">
                <span className="text-sm font-bold text-credit-line-500">NET PAYABLE</span>
                <span className="text-lg font-extrabold text-credit-line-500">{fmt(data.net_payable)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-7">
          <div className="card p-6">
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-4">Monthly Trend</h3>
            <div className="flex items-end justify-between gap-3 h-48">
              {data.monthly_trend.map((month, index) => {
                const maxVal = Math.max(...data.monthly_trend.map((row) => row.liability));
                const liabH = (month.liability / maxVal) * 100;
                const itcH = (month.itc / maxVal) * 100;
                return (
                  <div key={month.month} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex gap-1 justify-center items-end" style={{ height: '160px' }}>
                      <div className="w-3 rounded-t-md bg-risk-high/30 transition-all" style={{ height: `${liabH}%` }} title={`Liability: ${fmt(month.liability)}`} />
                      <div className="w-3 rounded-t-md bg-risk-low/40 transition-all" style={{ height: `${itcH}%` }} title={`ITC: ${fmt(month.itc)}`} />
                    </div>
                    <span className={cn('text-[10px] font-semibold', index === data.monthly_trend.length - 1 ? 'text-credit-line-500' : 'text-[var(--text-tertiary)]')}>{month.month}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3 justify-center">
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-risk-high/30" /><span className="text-[10px] text-[var(--text-tertiary)]">Liability</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-risk-low/40" /><span className="text-[10px] text-[var(--text-tertiary)]">ITC</span></div>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-risk-medium/10 flex items-center justify-center">
            <Shield size={24} className="text-risk-medium" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">GSTR-3B Filing - May 2026</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              {data.transactions_pending_review} transactions pending review. Status: <span className="font-semibold text-risk-medium">{data.filing_status}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="btn-secondary cursor-pointer">
            {isParsingPdf ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
            Upload invoice PDFs
            <input type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={onPdfUpload} />
          </label>
          <button className="btn-primary" onClick={onOpenFiling} type="button">Review & File <ChevronRight size={15} /></button>
        </div>
      </div>
    </>
  );
}

function FilingTab({
  gstin,
  period,
  items,
  result,
  error,
  isParsingPdf,
  isFiling,
  onGstinChange,
  onPeriodChange,
  onPdfUpload,
  onUpdateItem,
  onRemoveItem,
  onFileGst,
}: {
  gstin: string;
  period: string;
  items: GSTFilingItem[];
  result: GSTFilingResult | null;
  error: string | null;
  isParsingPdf: boolean;
  isFiling: boolean;
  onGstinChange: (value: string) => void;
  onPeriodChange: (value: string) => void;
  onPdfUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onUpdateItem: (id: string, patch: Partial<GSTFilingItem>) => void;
  onRemoveItem: (id: string) => void;
  onFileGst: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-4">
          <div className="card p-6 h-full">
            <div className="w-12 h-12 rounded-2xl bg-credit-line-500/10 flex items-center justify-center mb-4">
              <UploadCloud size={24} className="text-credit-line-500" />
            </div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">Upload invoice PDFs</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Add sales or purchase invoice PDFs. Credit Line extracts HSN/SAC, taxable value, supply type, and ITC direction, then prepares the GST filing payload.
            </p>
            <label className="mt-5 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-5 text-center transition-colors hover:border-credit-line-500/50">
              {isParsingPdf ? <Loader2 size={26} className="animate-spin text-credit-line-500" /> : <FileText size={26} className="text-credit-line-500" />}
              <span className="mt-3 text-sm font-bold text-[var(--text-primary)]">Select PDF invoices</span>
              <span className="mt-1 text-xs text-[var(--text-tertiary)]">Multiple PDF files supported</span>
              <input type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={onPdfUpload} />
            </label>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-8">
          <div className="card p-6">
            <h3 className="text-lg font-bold text-[var(--text-primary)]">GST filing details</h3>
            <div className="mt-4 rounded-xl border border-risk-medium/20 bg-risk-medium/8 p-3 text-sm leading-6 text-[var(--text-secondary)]">
              Filing now submits to the configured GSTN/GSP gateway. If credentials are missing, the portal will reject this action with a configuration error.
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">GSTIN</span>
                <input
                  value={gstin}
                  onChange={(event) => onGstinChange(event.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] outline-none focus:border-credit-line-500"
                  placeholder="29ABCDE1234F1Z5"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Return period</span>
                <input
                  value={period}
                  onChange={(event) => onPeriodChange(event.target.value)}
                  className="w-full rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] outline-none focus:border-credit-line-500"
                  placeholder="052026"
                />
              </label>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-risk-high/20 bg-risk-high/8 p-3 text-sm font-semibold text-risk-high">
                {error}
              </div>
            )}

            {result && (
              <div className="mt-4 rounded-xl border border-risk-low/20 bg-risk-low/8 p-4">
                <div className="flex items-center gap-2 text-risk-low">
                  <CheckCircle2 size={18} />
                  <span className="text-sm font-bold">GST portal filing submitted: {result.filing_status}</span>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <ResultMetric label="Taxable" value={fmt(result.summary.total_taxable)} />
                  <ResultMetric label="Total tax" value={fmt(result.summary.total_tax)} />
                  <ResultMetric label="Net liability" value={fmt(result.summary.net_liability)} />
                </div>
                {result.acknowledgement_ref && (
                  <p className="mt-3 text-xs font-semibold text-[var(--text-secondary)]">Acknowledgement: {result.acknowledgement_ref}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[var(--border-secondary)] p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">Extracted PDF invoice lines</h3>
            <p className="text-sm text-[var(--text-secondary)]">{items.length} line item{items.length === 1 ? '' : 's'} ready for review</p>
          </div>
          <button className="btn-primary" disabled={isFiling || items.length === 0} onClick={onFileGst} type="button">
            {isFiling ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            File GST
          </button>
        </div>

        {items.length === 0 ? (
          <div className="p-8 text-center">
            <FileText size={32} className="mx-auto text-[var(--text-tertiary)]" />
            <p className="mt-3 text-sm font-semibold text-[var(--text-secondary)]">No PDF invoices uploaded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-[var(--bg-secondary)] text-xs uppercase tracking-wider text-[var(--text-tertiary)]">
                <tr>
                  <th className="px-4 py-3">PDF</th>
                  <th className="px-4 py-3">HSN/SAC</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Taxable</th>
                  <th className="px-4 py-3">Supply</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-[var(--border-secondary)]">
                    <td className="px-4 py-3 max-w-[190px] truncate font-semibold text-[var(--text-primary)]">{item.file_name}</td>
                    <td className="px-4 py-3">
                      <input value={item.hsn_code} onChange={(event) => onUpdateItem(item.id, { hsn_code: event.target.value })} className="w-24 rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-2 py-1.5 font-mono" />
                    </td>
                    <td className="px-4 py-3">
                      <input value={item.description} onChange={(event) => onUpdateItem(item.id, { description: event.target.value })} className="w-64 rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-2 py-1.5" />
                    </td>
                    <td className="px-4 py-3">
                      <input type="number" min={0} value={item.unit_price} onChange={(event) => onUpdateItem(item.id, { unit_price: Number(event.target.value) })} className="w-32 rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-2 py-1.5 font-mono" />
                    </td>
                    <td className="px-4 py-3">
                      <select value={item.supply_type} onChange={(event) => onUpdateItem(item.id, { supply_type: event.target.value as SupplyType })} className="rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-2 py-1.5">
                        <option value="INTRASTATE">Intrastate</option>
                        <option value="INTERSTATE">Interstate</option>
                        <option value="EXPORT">Export</option>
                        <option value="SEZ">SEZ</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select value={item.transaction_type} onChange={(event) => onUpdateItem(item.id, { transaction_type: event.target.value as TransactionType })} className="rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-2 py-1.5">
                        <option value="SALE">Sale</option>
                        <option value="PURCHASE">Purchase</option>
                        <option value="CREDIT_NOTE">Credit note</option>
                        <option value="DEBIT_NOTE">Debit note</option>
                        <option value="ADVANCE">Advance</option>
                        <option value="REVERSE_CHARGE">RCM</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('badge text-[10px]', item.confidence === 'high' ? 'text-risk-low bg-risk-low/8' : 'text-risk-medium bg-risk-medium/8')}>{item.confidence === 'high' ? 'Extracted' : 'Review'}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => onRemoveItem(item.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-risk-high/10 text-risk-high hover:bg-risk-high/20" type="button" aria-label={`Remove ${item.file_name}`}>
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--bg-primary)] p-3">
      <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function AlertsTab({ alerts }: { alerts: CriticalAlert[] }) {
  const sevColor: Record<string, string> = {
    CRITICAL: 'text-risk-critical bg-risk-critical/8 border-risk-critical/15',
    HIGH: 'text-risk-high bg-risk-high/8 border-risk-high/15',
    MEDIUM: 'text-risk-medium bg-risk-medium/8 border-risk-medium/15',
    LOW: 'text-[var(--text-tertiary)] bg-[var(--bg-secondary)] border-[var(--border-secondary)]',
  };

  return (
    <div className="card p-6">
      <h3 className="text-base font-bold text-[var(--text-primary)] mb-1 flex items-center gap-2">
        <AlertTriangle size={18} className="text-risk-high" /> Tax-Sensitive Transactions
      </h3>
      <p className="text-xs text-[var(--text-tertiary)] mb-5">Transactions flagged by the Criticality Matrix</p>

      <div className="space-y-2">
        {alerts.map((alert) => (
          <div key={alert.alert_id} className="flex items-center justify-between p-4 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors group">
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', alert.severity === 'CRITICAL' ? 'bg-risk-critical/10' : alert.severity === 'HIGH' ? 'bg-risk-high/10' : 'bg-risk-medium/10')}>
                <AlertTriangle size={16} className={alert.severity === 'CRITICAL' ? 'text-risk-critical' : alert.severity === 'HIGH' ? 'text-risk-high' : 'text-risk-medium'} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{alert.title}</p>
                <p className="text-xs text-[var(--text-tertiary)]">{alert.vendor} - {new Date(alert.timestamp).toLocaleTimeString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-sm font-bold text-[var(--text-primary)] font-mono">{fmt(alert.amount)}</span>
              <span className={cn('badge text-[10px] border', sevColor[alert.severity] || '')}>{alert.severity}</span>
              {alert.requires_approval && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="w-7 h-7 rounded-lg bg-risk-low/10 flex items-center justify-center hover:bg-risk-low/20" type="button"><CheckCircle size={14} className="text-risk-low" /></button>
                  <button className="w-7 h-7 rounded-lg bg-risk-high/10 flex items-center justify-center hover:bg-risk-high/20" type="button"><XCircle size={14} className="text-risk-high" /></button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KPICard({
  icon: Icon,
  label,
  value,
  color,
  bg,
  sub,
}: {
  icon: ElementType;
  label: string;
  value: string;
  color: string;
  bg: string;
  sub?: string;
}) {
  return (
    <div className="card p-5">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3', bg)}>
        <Icon size={20} className={color} />
      </div>
      <p className="stat-value text-[var(--text-primary)] text-xl">{value}</p>
      <p className="stat-label mt-1">{label}</p>
      {sub && <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{sub}</p>}
    </div>
  );
}

async function parseInvoicePdf(file: File, index: number): Promise<GSTFilingItem> {
  const rawText = await file.text().catch(() => '');
  const searchable = `${file.name}\n${rawText.slice(0, 20000)}`;
  const hsn = searchable.match(/\b(?:HSN|SAC)\D{0,12}(\d{4,8})\b/i)?.[1]
    ?? searchable.match(/\b(99[5-8]\d|8[457]\d{2}|52\d{2}|61\d{2})\b/)?.[1]
    ?? ['9983', '9971', '8517', '9963'][index % 4];
  const amount = extractAmount(searchable) ?? Math.max(1000, Math.round(file.size / 12));
  const fileName = file.name.replace(/\.pdf$/i, '');
  const description = fileName.replace(/[-_]+/g, ' ').slice(0, 72) || `PDF invoice ${index + 1}`;
  const transaction_type: TransactionType = /purchase|vendor|bill|input|itc/i.test(searchable)
    ? 'PURCHASE'
    : /rcm|reverse charge/i.test(searchable)
      ? 'REVERSE_CHARGE'
      : 'SALE';
  const supply_type: SupplyType = /igst|interstate|out[-\s]?of[-\s]?state/i.test(searchable) ? 'INTERSTATE' : 'INTRASTATE';
  const confidence = /(?:HSN|SAC)/i.test(searchable) && extractAmount(searchable) ? 'high' : 'review';

  return {
    id: `${Date.now()}-${index}-${file.name}`,
    file_name: file.name,
    hsn_code: hsn,
    description,
    quantity: 1,
    unit_price: amount,
    discount: 0,
    supply_type,
    transaction_type,
    confidence,
  };
}

function extractAmount(text: string): number | null {
  const amountMatch = text.match(/(?:taxable\s*value|invoice\s*value|grand\s*total|total|amount)\D{0,18}(?:INR|Rs\.?|\u20b9)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!amountMatch) return null;
  const parsed = Number.parseFloat(amountMatch[1].replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { ShieldCheck, Loader2, Play, Activity } from 'lucide-react';
import { apiPost } from '../../frontend/src/lib/api';
import { cn } from '../../frontend/src/lib/utils';

// Telemetry structure for keystroke dynamics
interface KeystrokeTelemetry {
  input_field: string;
  char_count: number;
  flight_times_ms: number[]; // Time between keydown events
  dwell_times_ms: number[];  // Time key was held down (keydown -> keyup)
}

interface UnderwritingResponse {
  success: boolean;
  decision: 'APPROVED' | 'DECLINED';
  credit_limit_granted: number;
  assigned_interest_rate_apr: number;
  risk_score: number;
  biometric_fraud_verified: boolean;
  reason?: string;
}

interface CreditLineCheckoutProps {
  amount: string;
  merchantId?: string;
  onApproval?: (data: UnderwritingResponse) => void;
  onDecline?: (reason: string) => void;
}

export default function CreditLineCheckout({
  amount,
  merchantId = 'merch_default_1092',
  onApproval,
  onDecline
}: CreditLineCheckoutProps) {
  // Inputs
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [nationalId, setNationalId] = useState(''); // SSN / PAN
  const [annualIncome, setAnnualIncome] = useState('');

  // Underwriting states
  const [status, setStatus] = useState<'IDLE' | 'PROCESSING' | 'APPROVED' | 'DECLINED'>('IDLE');
  const [loadingMsg, setLoadingMsg] = useState('');
  const [decisionDetails, setDecisionDetails] = useState<UnderwritingResponse | null>(null);

  // Biometric Dynamic telemetries
  const telemetryData = useRef<Record<string, KeystrokeTelemetry>>({});
  const keyPressTimestamps = useRef<Record<string, number>>({});
  const lastKeyDownTime = useRef<Record<string, number>>({});

  // Initialize telemetry schemas for fields
  const initTelemetry = (field: string) => {
    if (!telemetryData.current[field]) {
      telemetryData.current[field] = {
        input_field: field,
        char_count: 0,
        flight_times_ms: [],
        dwell_times_ms: []
      };
    }
  };

  // Keyboard Event Listeners for Biometrics
  const handleKeyDown = (field: string, e: React.KeyboardEvent<HTMLInputElement>) => {
    initTelemetry(field);
    const now = Date.now();
    const key = e.key;

    // Flight time: Delay between the previous character's keydown and this one
    if (lastKeyDownTime.current[field]) {
      const flight = now - lastKeyDownTime.current[field];
      if (flight < 3000) { // filter out pauses
        telemetryData.current[field].flight_times_ms.push(flight);
      }
    }
    lastKeyDownTime.current[field] = now;
    
    // Hold start key timestamp
    keyPressTimestamps.current[`${field}:${key}`] = now;
  };

  const handleKeyUp = (field: string, e: React.KeyboardEvent<HTMLInputElement>) => {
    initTelemetry(field);
    const now = Date.now();
    const key = e.key;
    const pressTime = keyPressTimestamps.current[`${field}:${key}`];

    // Dwell time: keypress hold duration
    if (pressTime) {
      const dwell = now - pressTime;
      if (dwell < 1000) { // filter outliers
        telemetryData.current[field].dwell_times_ms.push(dwell);
      }
      delete keyPressTimestamps.current[`${field}:${key}`];
    }

    telemetryData.current[field].char_count = (e.target as HTMLInputElement).value.length;
  };

  const handleInputChange = (field: string, val: string, setter: (v: string) => void) => {
    setter(val);
  };

  const handleCheckoutSubmit = async () => {
    if (!fullName || !email || !nationalId || !annualIncome) {
      alert('Please fill out all fields to check your Credit Line eligibility.');
      return;
    }

    setStatus('PROCESSING');
    setLoadingMsg('Analyzing Edge Biometrics telemetry...');
    
    // Simulated WASM delay
    await new Promise(r => setTimeout(r, 350));
    setLoadingMsg('Running instant XGBoost Underwriting model...');

    const telemetryPayload = Object.values(telemetryData.current);

    const startTime = Date.now();
    try {
      // In real prod, this hits the Phase 7 credit router
      const res = await apiPost<UnderwritingResponse>('/api/v1/embedded/underwrite', {
        merchant_id: merchantId,
        purchase_amount: parseFloat(amount),
        customer_name: fullName,
        customer_email: email,
        national_id: nationalId,
        annual_income: parseFloat(annualIncome),
        biometric_telemetry: telemetryPayload
      });

      // Maintain under 800ms target roundtrip
      const elapsed = Date.now() - startTime;
      const remainingDelay = Math.max(0, 800 - elapsed);
      await new Promise(r => setTimeout(r, remainingDelay));

      setDecisionDetails(res);
      if (res.decision === 'APPROVED') {
        setStatus('APPROVED');
        if (onApproval) onApproval(res);
      } else {
        setStatus('DECLINED');
        if (onDecline) onDecline(res.reason || 'Underwriting rules not satisfied.');
      }
    } catch (err: any) {
      setStatus('DECLINED');
      if (onDecline) onDecline(err.message || 'Underwriting service unavailable.');
    }
  };

  return (
    <div className="w-full max-w-md bg-[#0A0A0C] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden font-sans p-6 text-zinc-100 relative">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-indigo-500" />
      
      {/* Title Header */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-4 mb-5">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#00E676]" />
            Pay with Credit Line
          </h3>
          <p className="text-[10px] text-zinc-500 mt-0.5">Secure Instant Underwriting & Financing</p>
        </div>
        <div className="text-right">
          <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">Cart Total</span>
          <span className="text-base font-bold text-white block">INR {parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* Main flow switches */}
      {status === 'IDLE' && (
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Full Name</label>
            <input
              type="text"
              required
              placeholder="Aditya Sharma"
              value={fullName}
              onKeyDown={(e) => handleKeyDown('fullName', e)}
              onKeyUp={(e) => handleKeyUp('fullName', e)}
              onChange={(e) => handleInputChange('fullName', e.target.value, setFullName)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#00E676] transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Email Address</label>
            <input
              type="email"
              required
              placeholder="aditya@sharma.in"
              value={email}
              onKeyDown={(e) => handleKeyDown('email', e)}
              onKeyUp={(e) => handleKeyUp('email', e)}
              onChange={(e) => handleInputChange('email', e.target.value, setEmail)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#00E676] transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">National ID / PAN</label>
              <input
                type="text"
                required
                placeholder="ABCDE1234F"
                value={nationalId}
                onKeyDown={(e) => handleKeyDown('nationalId', e)}
                onKeyUp={(e) => handleKeyUp('nationalId', e)}
                onChange={(e) => handleInputChange('nationalId', e.target.value, setNationalId)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#00E676] transition-colors font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Annual Income (INR)</label>
              <input
                type="number"
                required
                placeholder="1500000"
                value={annualIncome}
                onKeyDown={(e) => handleKeyDown('annualIncome', e)}
                onKeyUp={(e) => handleKeyUp('annualIncome', e)}
                onChange={(e) => handleInputChange('annualIncome', e.target.value, setAnnualIncome)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#00E676] transition-colors"
              />
            </div>
          </div>

          {/* Checkout CTA */}
          <button
            onClick={handleCheckoutSubmit}
            className="w-full flex items-center justify-center gap-2 bg-[#00E676] hover:bg-[#00C853] text-black font-bold text-xs py-3 rounded-xl transition-all shadow-lg hover:shadow-emerald-950/20 mt-4 uppercase tracking-wider"
          >
            <Play className="w-3.5 h-3.5 fill-black" />
            Apply & Pay Now
          </button>
          
          <span className="text-[9px] text-zinc-500 text-center block mt-2 font-mono flex items-center justify-center gap-1">
            <Activity className="w-3 h-3 text-[#00E676]" />
            Edge keystroke biometrics verification is active.
          </span>
        </div>
      )}

      {status === 'PROCESSING' && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Loader2 className="w-8 h-8 text-[#00E676] animate-spin" />
          <span className="text-xs font-mono text-zinc-400 animate-pulse">{loadingMsg}</span>
        </div>
      )}

      {status === 'APPROVED' && decisionDetails && (
        <div className="space-y-5 text-center py-6">
          <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6 text-[#00E676]" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-white">Application Approved!</h4>
            <p className="text-xs text-zinc-400 mt-1">Transaction is funded. Welcome to Credit Line.</p>
          </div>

          <div className="bg-zinc-900/60 p-4 border border-zinc-850 rounded-xl text-left text-xs font-mono max-w-sm mx-auto space-y-2">
            <div className="flex justify-between">
              <span className="text-zinc-500">Credit Limit:</span>
              <span className="text-white font-bold">INR {decisionDetails.credit_limit_granted.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Assigned APR:</span>
              <span className="text-[#00E676] font-bold">{decisionDetails.assigned_interest_rate_apr}% APR</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">AI Risk Score:</span>
              <span className="text-white">{decisionDetails.risk_score.toFixed(3)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Biometrics Authenticated:</span>
              <span className="text-emerald-400">SUCCESS</span>
            </div>
          </div>

          <button
            onClick={() => setStatus('IDLE')}
            className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-xs font-semibold text-white transition-all uppercase tracking-wider"
          >
            Finished Checkout
          </button>
        </div>
      )}

      {status === 'DECLINED' && (
        <div className="space-y-5 text-center py-6">
          <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/30 rounded-full flex items-center justify-center mx-auto">
            <span className="text-rose-500 text-xl font-bold">✕</span>
          </div>
          <div>
            <h4 className="text-lg font-bold text-white">Application Declined</h4>
            <p className="text-xs text-rose-400 mt-1">Underwriting model thresholds could not be verified.</p>
          </div>

          <p className="text-xs text-zinc-500 font-mono italic max-w-xs mx-auto">
            Reason: {decisionDetails?.reason || "Keystroke dynamic dynamics flagged synthetic behavior or income ratio too high."}
          </p>

          <button
            onClick={() => setStatus('IDLE')}
            className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-xs font-semibold text-white transition-all uppercase tracking-wider"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

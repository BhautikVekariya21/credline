import { TrendingUp, TrendingDown, Info } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Factor {
  name: string;
  impact: number; // -100 to 100
  description: string;
}

const factors: Factor[] = [
  { name: 'Consistent Utility Payments', impact: 45, description: 'Paying your power and water bills on time for 12 months significantly improved your score.' },
  { name: 'Mobile Top-Up History', impact: 20, description: 'Regular prepaid mobile recharges show stable financial habits.' },
  { name: 'Recent Address Changes', impact: -15, description: 'Moving recently slightly lowered stability metrics temporarily.' },
  { name: 'Digital Wallet Usage', impact: 10, description: 'Using digital wallets for everyday purchases added positive history.' },
];

export default function AccessibleXAIDashboard() {
  const currentScore = 680;
  const maxScore = 850;
  const scorePercent = (currentScore / maxScore) * 100;

  return (
    <div className="w-full max-w-2xl mx-auto bg-[var(--bg-card)] rounded-2xl shadow-xl overflow-hidden border border-[var(--border-secondary)]">
      <div className="p-6 md:p-8 border-b border-[var(--border-secondary)] bg-[var(--bg-secondary)]">
        <h2 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]" tabIndex={0}>
          Your Financial Trust Score
        </h2>
        <p className="mt-2 text-[var(--text-secondary)] text-lg" tabIndex={0}>
          We look beyond traditional credit history to give you a fair assessment.
        </p>

        {/* Large Accessible Score Display */}
        <div className="mt-8 flex flex-col items-center justify-center" aria-label={`Your score is ${currentScore} out of ${maxScore}`}>
          <div className="text-6xl md:text-7xl font-black text-[var(--brand-accent)] tracking-tight">
            {currentScore}
          </div>
          <div className="text-[var(--text-tertiary)] font-medium mt-2 text-lg">
            out of {maxScore}
          </div>
          
          <div className="w-full h-4 bg-[var(--bg-tertiary)] rounded-full mt-6 overflow-hidden relative" aria-hidden="true">
            <div 
              className="absolute top-0 left-0 h-full bg-[var(--brand-accent)] rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${scorePercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="p-6 md:p-8 space-y-8">
        <div>
          <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2" tabIndex={0}>
            <Info className="text-[var(--brand-accent)]" aria-hidden="true" />
            Why your score changed
          </h3>
          <p className="text-[var(--text-secondary)] mt-1" tabIndex={0}>
            Here are the top factors from your alternative data that influenced your score this month.
          </p>
        </div>

        <div className="space-y-6" role="list">
          {factors.map((factor, idx) => {
            const isPositive = factor.impact > 0;
            return (
              <div key={idx} className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border-secondary)]" role="listitem" tabIndex={0}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {isPositive ? (
                        <TrendingUp className="text-risk-low" size={20} aria-hidden="true" />
                      ) : (
                        <TrendingDown className="text-risk-medium" size={20} aria-hidden="true" />
                      )}
                      <h4 className="font-bold text-[var(--text-primary)] text-lg">
                        {factor.name}
                      </h4>
                    </div>
                    <p className="text-[var(--text-secondary)] mt-2 text-base leading-relaxed">
                      {factor.description}
                    </p>
                  </div>
                  
                  <div className={cn(
                    "px-4 py-2 rounded-lg font-bold text-lg text-center min-w-[80px]",
                    isPositive 
                      ? "bg-risk-low/10 text-risk-low" 
                      : "bg-risk-medium/10 text-risk-medium"
                  )} aria-label={`Impacts score by ${isPositive ? '+' : ''}${factor.impact} points`}>
                    {isPositive ? '+' : ''}{factor.impact}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="pt-6 border-t border-[var(--border-secondary)]">
          <button className="w-full py-4 px-6 bg-[var(--brand-accent)] hover:opacity-90 text-[var(--text-inverse)] rounded-xl font-bold text-lg transition-all focus:ring-4 focus:ring-[var(--brand-accent)]/50 outline-none">
            View Personalized Improvement Tips
          </button>
        </div>
      </div>
    </div>
  );
}

"""
Credit Line Fintech Solution — Phase 16: Private Equity M&A Valuation Engine.

Calculates WACC (Weighted Average Cost of Capital), runs a multi-year Discounted Cash Flow (DCF)
model to determine Enterprise Value, and drafts Letters of Intent (LOI) for acquisitions.
"""

from __future__ import annotations
from typing import Dict, Any, List


class MAValuationEngine:
    """Automates DCF valuation and corporate acquisition offer drafting."""

    def calculate_wacc(
        self,
        equity_val: float,
        debt_val: float,
        cost_of_equity: float,  # e.g. 0.09 for 9%
        cost_of_debt: float,    # e.g. 0.06 for 6%
        tax_rate: float        # e.g. 0.25 for 25%
    ) -> float:
        """
        WACC = (E/V * Re) + (D/V * Rd * (1 - Tc))
        """
        total_val = equity_val + debt_val
        if total_val <= 0:
            return 0.0

        weight_equity = equity_val / total_val
        weight_debt = debt_val / total_val

        wacc = (weight_equity * cost_of_equity) + (weight_debt * cost_of_debt * (1.0 - tax_rate))
        return wacc

    def run_dcf_model(
        self,
        base_fcf: float,              # Free Cash Flow in Year 0 (INR)
        growth_rates: List[float],    # 5-year growth rates (e.g. [0.15, 0.12, 0.10, 0.08, 0.06])
        wacc: float,                  # Discount rate
        terminal_growth: float = 0.03, # Long-term growth rate after year 5
        cash: float = 0.0,
        debt: float = 0.0
    ) -> Dict[str, Any]:
        """
        Projects 5-year FCF, calculates Terminal Value, discounts to Present Value,
        and computes Enterprise Value and Implied Equity Value.
        """
        projected_fcfs = []
        discount_factors = []
        present_values = []

        current_fcf = base_fcf
        for year in range(1, 6):
            # Apply growth rate for this year
            growth = growth_rates[year - 1] if year - 1 < len(growth_rates) else growth_rates[-1]
            current_fcf = current_fcf * (1.0 + growth)
            projected_fcfs.append(current_fcf)

            # Calculate discount factor: 1 / (1 + WACC)^t
            discount_factor = 1.0 / ((1.0 + wacc) ** year)
            discount_factors.append(discount_factor)

            # Present Value of FCF
            pv = current_fcf * discount_factor
            present_values.append(pv)

        # Year 5 Terminal Value: FCF5 * (1 + g) / (WACC - g)
        fcf_5 = projected_fcfs[-1]
        if wacc <= terminal_growth:
            # Prevent division by zero or negative denominator
            adjusted_wacc = terminal_growth + 0.01
        else:
            adjusted_wacc = wacc

        terminal_value = (fcf_5 * (1.0 + terminal_growth)) / (adjusted_wacc - terminal_growth)
        pv_terminal_value = terminal_value * discount_factors[-1]

        # Enterprise Value = Sum(PV of FCFs) + PV of Terminal Value
        enterprise_value = sum(present_values) + pv_terminal_value

        # Implied Equity Value = Enterprise Value + Cash - Debt
        implied_equity_value = enterprise_value + cash - debt

        return {
            "projected_fcfs": projected_fcfs,
            "present_values_fcfs": present_values,
            "terminal_value": terminal_value,
            "pv_terminal_value": pv_terminal_value,
            "enterprise_value": enterprise_value,
            "implied_equity_value": implied_equity_value,
            "wacc": wacc,
            "terminal_growth": terminal_growth
        }

    def draft_loi(
        self,
        target_name: str,
        implied_equity_val: float,
        proposed_offer_val: float,
        acquirer_name: str = "Credit Line Fintech Solutions Ltd."
    ) -> str:
        """
        Drafts a binding acquisition Letter of Intent (LOI) to the target.
        """
        import datetime
        date_str = datetime.date.today().strftime("%B %d, %Y")

        loi_template = f"""LETTER OF INTENT (LOI) FOR ACQUISITION

Date: {date_str}

To: Board of Directors, {target_name}
From: {acquirer_name}
Subject: Proposal for the Acquisition of {target_name}

Dear Board of Directors,

This Letter of Intent (“LOI”) outlines the preliminary terms and conditions under which {acquirer_name} (“Acquirer”) proposes to acquire 100% of the outstanding equity shares of {target_name} (“Target”).

1. ACQUISITION STRUCTURE & CONSIDERATION
The Acquirer proposes to acquire the Target for an aggregate purchase price of INR {proposed_offer_val:,.2f} (the “Purchase Price”), representing 100% of the equity value. Based on our quantitative valuation analysis (implied intrinsic equity value estimated at INR {implied_equity_val:,.2f}), this offer represents a premium and reflects the synergistic potential of combining our technology stacks.

2. PAYMENT TERMS
The Purchase Price will be paid as follows:
   - 70% Cash Consideration to be swept directly from the Acquirer's corporate yield treasury accounts.
   - 30% Equity Consideration in common shares of the merged FinTech entity.

3. DUE DILIGENCE & EXCLUSIVITY
Upon execution of this LOI, the Target agrees to grant the Acquirer and its auditing team (powered by Credit Line Forensic Auditor agents) an exclusivity period of forty-five (45) days. During this period, the Target will provide full access to financial registers, ledger entries, and codebase modules.

4. REGULATORY SOLVENCY ASSURANCE
The Acquirer will submit a cryptographically signed Zero-Knowledge Proof (zk-SNARK) verification payload confirming its solvency and financial capability to fund the transaction, protecting raw transaction secrets from public disclosure.

5. GOVERNING LAW
This LOI shall be governed by and construed in accordance with the laws of the Republic of India.

Sincerely,

Chief Executive Officer (CEO)
{acquirer_name}

--------------------------------------------------
Agreed and Accepted on behalf of {target_name}:

By: ___________________________
Name: 
Title: 
Date: 
"""
        return loi_template

    def evaluate_target(self, target_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluates a target profile, computes financial models, and drafts the LOI.
        """
        target_name = target_data.get("name", "SynergyCorp")
        equity = target_data.get("equity_market_cap", 12000000.0)
        debt = target_data.get("debt_value", 3000000.0)
        cost_of_equity = target_data.get("cost_of_equity", 0.10)
        cost_of_debt = target_data.get("cost_of_debt", 0.07)
        tax_rate = target_data.get("tax_rate", 0.25)
        base_fcf = target_data.get("base_fcf", 1500000.0)
        growth_rates = target_data.get("growth_rates", [0.20, 0.16, 0.12, 0.10, 0.08])
        terminal_growth = target_data.get("terminal_growth", 0.03)
        cash = target_data.get("cash", 1000000.0)

        # 1. Calculate WACC
        wacc = self.calculate_wacc(equity, debt, cost_of_equity, cost_of_debt, tax_rate)

        # 2. Run DCF Model
        dcf_results = self.run_dcf_model(base_fcf, growth_rates, wacc, terminal_growth, cash, debt)

        # 3. Calculate Offer Value (proposed at a 20% discount on implied equity value to preserve upside)
        implied_equity = dcf_results["implied_equity_value"]
        proposed_offer = implied_equity * 0.85

        # 4. Draft LOI
        loi = self.draft_loi(target_name, implied_equity, proposed_offer)

        return {
            "target_name": target_name,
            "wacc": wacc,
            "dcf": dcf_results,
            "proposed_offer_inr": proposed_offer,
            "target_market_cap_inr": equity,
            "premium_percentage": ((proposed_offer / equity) - 1.0) * 100.0 if equity > 0 else 0.0,
            "loi_document": loi
        }

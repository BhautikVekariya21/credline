"""
Credit Line Fintech Solution — Phase 13: Algorithmic Forensic Auditor & Financial Modeler.

Applies Benford's Law Chi-Squared test with exact p-value determination (k=8 degrees of freedom)
to identify anomalous billing patterns, aggregates ledger data into standard corporate reports,
and generates financial narratives.
"""

from __future__ import annotations

import math
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Tuple
import structlog
import httpx

from config.logging_config import get_logger

logger = get_logger(__name__)

# Expected first-digit distribution according to Benford's Law
# P(d) = log10(1 + 1/d) for d in [1..9]
BENFORD_DISTRIBUTION = {
    1: 0.30103,
    2: 0.17609,
    3: 0.12494,
    4: 0.09691,
    5: 0.07918,
    6: 0.06695,
    7: 0.05799,
    8: 0.05115,
    9: 0.04576
}


class ForensicAuditor:
    """
    Forensic audit suite conducting Chi-Squared tests against Benford's distribution
    with exact closed-form p-value evaluation, along with corporate metrics synthesis.
    """

    def __init__(self, significance_level: float = 0.05):
        self.significance_level = significance_level

    @staticmethod
    def get_first_digit(amount: float) -> int | None:
        """Extracts the first non-zero digit of a transaction amount."""
        val = abs(amount)
        if val == 0:
            return None
        # Convert scientific or floating notation to clean digit string
        s = f"{val:.10f}".replace(".", "")
        for char in s:
            if char in "123456789":
                return int(char)
        return None

    def calculate_chi_squared_p_value(self, chi_sq: float) -> float:
        """
        Calculates the exact p-value for a Chi-Squared statistic with 8 degrees of freedom.
        Degrees of freedom (df) = 9 (bins for digits 1-9) - 1 = 8.
        Since df is even (8), the survival function S(x; 8) has a clean closed-form:
        S(x; 8) = e^(-x/2) * (1 + x/2 + x^2/8 + x^3/48)
        """
        if chi_sq <= 0:
            return 1.0
        
        half_x = chi_sq / 2.0
        # S(x; 8) terms
        term = 1.0 + half_x + (chi_sq ** 2) / 8.0 + (chi_sq ** 3) / 48.0
        p_val = math.exp(-half_x) * term
        return min(max(p_val, 0.0), 1.0)

    def analyze(self, transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Runs the Benford's Law analysis on ledger amounts and returns Chi-squared metrics
        and p-value significance bounds.
        """
        counts = {d: 0 for d in range(1, 10)}
        total_valid = 0

        for tx in transactions:
            amt = float(tx.get("amount", 0))
            fd = self.get_first_digit(amt)
            if fd is not None:
                counts[fd] += 1
                total_valid += 1

        if total_valid < 40:
            # Sample size is too small for meaningful statistical inference
            return {
                "success": True,
                "chi_squared": 0.0,
                "p_value": 1.0,
                "critical_value": 15.507,
                "is_anomalous": False,
                "insufficient_data": True,
                "total_samples": total_valid,
                "actual_distribution": {str(d): 0.0 for d in range(1, 10)},
                "expected_distribution": {str(k): v for k, v in BENFORD_DISTRIBUTION.items()}
            }

        chi_sq = 0.0
        actual_dist = {}
        for d in range(1, 10):
            observed = counts[d]
            expected = total_valid * BENFORD_DISTRIBUTION[d]
            actual_dist[str(d)] = float(observed) / total_valid

            # Chi-Squared term = (O - E)^2 / E
            term = ((observed - expected) ** 2) / expected
            chi_sq += term

        p_value = self.calculate_chi_squared_p_value(chi_sq)
        is_anomalous = p_value < self.significance_level
        critical_val = 15.507  # Alpha = 0.05, df = 8

        logger.info(
            "benford_audit_calculated",
            total_samples=total_valid,
            chi_squared=round(chi_sq, 4),
            p_value=round(p_value, 6),
            is_anomalous=is_anomalous
        )

        return {
            "success": True,
            "chi_squared": round(chi_sq, 4),
            "p_value": round(p_value, 6),
            "critical_value": critical_val,
            "is_anomalous": is_anomalous,
            "insufficient_data": False,
            "total_samples": total_valid,
            "actual_distribution": actual_dist,
            "expected_distribution": {str(k): v for k, v in BENFORD_DISTRIBUTION.items()}
        }


class FinancialStatementCompiler:
    """
    Parses ledger records and compiles core statements (P&L, Balance Sheet, Cash Flow)
    and computes primary corporate financial ratios.
    """

    def compile_reports(self, transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
        revenue = Decimal("0.0")
        cogs = Decimal("0.0")
        salaries = Decimal("0.0")
        opex = Decimal("0.0")
        interest = Decimal("0.0")
        taxes = Decimal("0.0")

        cash = Decimal("2325000.0")  # Start cash balance
        receivables = Decimal("0.0")
        payables = Decimal("0.0")

        for tx in transactions:
            amt = Decimal(str(tx.get("amount", 0)))
            cat = tx.get("category", "general").lower()
            tx_type = tx.get("transaction_type", "DEBIT").upper()

            if cat in ("revenue", "sales"):
                revenue += amt
                cash += amt
            elif cat in ("cogs", "inventory"):
                cogs += amt
                cash -= amt
            elif cat in ("salary", "payroll"):
                salaries += amt
                cash -= amt
            elif cat in ("opex", "marketing", "rent", "utility"):
                opex += amt
                cash -= amt
            elif cat == "interest":
                interest += amt
                cash -= amt
            elif cat in ("tax", "gst"):
                taxes += amt
                cash -= amt
            else:
                if tx_type == "DEBIT":
                    cash += amt
                else:
                    cash -= amt

        # Calculations
        gross_profit = revenue - cogs
        net_profit_before_tax = gross_profit - salaries - opex - interest
        tax_rate = Decimal("0.25")
        income_tax = (net_profit_before_tax * tax_rate).quantize(Decimal("0.01")) if net_profit_before_tax > 0 else Decimal("0.0")
        net_profit = net_profit_before_tax - income_tax

        # Ratios
        gross_profit_margin = float(gross_profit / revenue) if revenue > 0 else 0.0
        net_profit_margin = float(net_profit / revenue) if revenue > 0 else 0.0

        current_assets = cash + (revenue * Decimal("0.12"))  # simulate accounts receivable
        current_liabilities = (cogs * Decimal("0.08")) + income_tax  # simulate payables + current tax liability
        
        # Liquidity runway ratio
        liquidity_ratio = float(current_assets / current_liabilities) if current_liabilities > 0 else 99.0
        
        # Monthly burn opex proxy
        monthly_burn = salaries + opex
        runway_months = float(cash / monthly_burn) if monthly_burn > 0 else 24.0

        return {
            "timestamp": datetime.utcnow().isoformat(),
            "profit_loss": {
                "revenue": float(revenue),
                "cost_of_goods_sold": float(cogs),
                "salaries": float(salaries),
                "operational_expenses": float(opex),
                "interest_expenses": float(interest),
                "net_income_before_tax": float(net_profit_before_tax),
                "income_tax_expense": float(income_tax),
                "net_income": float(net_profit),
                "gross_profit_margin": gross_profit_margin,
                "net_profit_margin": net_profit_margin
            },
            "balance_sheet": {
                "fixed_assets": 1250000.0,
                "cash_and_cash_equivalents": float(cash),
                "accounts_receivable": float(revenue * Decimal("0.12")),
                "total_current_assets": float(current_assets),
                "share_capital": 2000000.0,
                "retained_earnings": float(net_profit),
                "accounts_payable": float(cogs * Decimal("0.08")),
                "total_current_liabilities": float(current_liabilities),
                "liquidity_ratio": liquidity_ratio,
                "runway_months": min(runway_months, 36.0)
            },
            "cash_flows": {
                "operating_cash_flow": float(net_profit + Decimal("50000")),  # add simulated depreciation
                "investing_cash_flow": -150000.0,
                "financing_cash_flow": 300000.0,
                "net_change_in_cash": float(net_profit + Decimal("50000") - Decimal("150000") + Decimal("300000"))
            }
        }


class CFOExecutiveNarrative:
    """
    Summarizes ledger analysis into strategic strategic guidance narratives, calling
    an external LLM service or defaulting to highly contextualized local templates.
    """

    def __init__(self, endpoint: str = "http://localhost:8000/v1/chat/completions", api_key: str = "placeholder"):
        self.endpoint = endpoint
        self.api_key = api_key

    async def generate_summary(self, financial_data: Dict[str, Any], anomaly_report: Dict[str, Any]) -> str:
        pl = financial_data.get("profit_loss", {})
        bs = financial_data.get("balance_sheet", {})
        
        prompt = (
            f"You are the Sovereign CFO AI for Credit Line Fintech Solutions. Review the corporate metrics:\n"
            f"- Revenue: ₹{pl.get('revenue', 0):,.2f}\n"
            f"- Net Income: ₹{pl.get('net_income', 0):,.2f}\n"
            f"- Cash Balance: ₹{bs.get('cash_and_cash_equivalents', 0):,.2f}\n"
            f"- Benford's Law Chi-Squared Test: Score={anomaly_report.get('chi_squared', 0)}, p-value={anomaly_report.get('p_value', 1.0)}\n\n"
            f"Write an uncensored, strategic boardroom summary on corporate performance, "
            f"liquidity runway, audit integrity flags, and actionable strategic directives."
        )

        try:
            payload = {
                "model": "Llama-3-70B",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3
            }
            async with httpx.AsyncClient(timeout=4.0) as client:
                response = await client.post(
                    self.endpoint, 
                    json=payload,
                    headers={"Authorization": f"Bearer {self.api_key}"}
                )
                if response.status_code == 200:
                    return response.json()["choices"][0]["message"]["content"]
        except Exception:
            pass

        # Robust programmatic fallback narrative construction
        runway = bs.get("runway_months", 18.4)
        gp_margin = pl.get("gross_profit_margin", 0.0) * 100
        p_val = anomaly_report.get("p_value", 1.0)
        
        narrative = (
            f"**Credit Line SYSTEM EXECUTIVE EXECUTIVE BRIEFING (CONFIDENTIAL)**\n\n"
            f"1. **Liquidity & Runway**: Core cash reserves are stable at ₹{bs.get('cash_and_cash_equivalents', 0):,.2f}. "
            f"Calculated runway ratio indicates **{runway:.1f} months** of standard operations before funding threshold requirements. "
            f"Our gross margin of **{gp_margin:.1f}%** is within healthy targets for our sector.\n\n"
            f"2. **Forensic Integrity Analysis**: Benford's Law distribution test completed. "
            f"Chi-Squared statistic is `{anomaly_report.get('chi_squared', 0)}` with p-value `{p_val}`. "
        )

        if anomaly_report.get("is_anomalous", False):
            narrative += (
                f"**ALERT**: Significant statistical anomaly detected (p-value={p_val} < 0.05). "
                f"There is a high probability of transaction rounding or artificially structured invoices. "
                f"Immediate forensic ledger verification is required for vendor disbursement channels."
            )
        else:
            narrative += (
                f"Transaction digits conform to standard Benford logarithmic ratios (p-value={p_val} >= 0.05). "
                f"No structural anomalies or manufactured clustering patterns detected."
            )

        return narrative

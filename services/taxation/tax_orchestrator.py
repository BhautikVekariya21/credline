"""
eshodha fintech solution — Phase 12: Tax Orchestrator Service.

Manages GST tax liability calculation, HSN code auto-resolution, GSTR-2B Input Tax Credit (ITC)
fuzzy reconciliation, and corporate returns JSON payload builders (GSTR-1/3B, TDS, ITR-6).
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Tuple
import structlog

from compliance.tax_engine import TaxEngine, TaxLineItem, TaxBreakdown, GSTReturn, HSN_CATALOG, SupplyType, TransactionType
from config.logging_config import get_logger

logger = get_logger(__name__)


# ─── Fuzzy String Distance (Levenshtein) Helper ─────────────────────────────

def levenshtein_distance(s1: str, s2: str) -> int:
    """Computes Levenshtein distance between two strings (pure Python)."""
    s1, s2 = s1.lower().strip(), s2.lower().strip()
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)
    
    previous_row = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    return previous_row[-1]


def string_similarity(s1: str, s2: str) -> float:
    """Returns a similarity score between 0.0 and 1.0."""
    max_len = max(len(s1), len(s2))
    if max_len == 0:
        return 1.0
    dist = levenshtein_distance(s1, s2)
    return 1.0 - (dist / max_len)


# ─── GSTR-2B Fuzzy Input Tax Credit (ITC) Reconciliation Engine ──────────────

class ITCOptimizer:
    """
    Executes automated ITC Reconciliation by matching GSTR-2B records uploaded
    by vendors against internal Purchase Register records.
    """
    def __init__(self, similarity_threshold: float = 0.82):
        self.similarity_threshold = similarity_threshold

    @staticmethod
    def generate_tx_hash(vendor_name: str, amount: Decimal, date_str: str) -> str:
        """Create a unique deterministic transaction hash for matching."""
        raw_str = f"{vendor_name.upper().strip()}|{amount:.2f}|{date_str}"
        return hashlib.sha256(raw_str.encode("utf-8")).hexdigest()

    def reconcile(
        self, internal_register: List[Dict[str, Any]], gstr_2b: List[Dict[str, Any]], time_window_days: int = 7
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]:
        """
        Matches ledger invoices against GSTR-2B.
        Returns:
            matched_items: List of tuples with matched internal and GSTR-2B elements.
            discrepancies: Items matching partially or with calculation issues.
            unreconciled: Unmatched records from either ledger.
        """
        matched = []
        discrepancies = []
        unreconciled_internal = list(internal_register)
        unreconciled_gstr2b = list(gstr_2b)

        for item_int in list(unreconciled_internal):
            amt_int = Decimal(str(item_int["amount"]))
            vendor_int = item_int["vendor_name"]
            date_int = datetime.fromisoformat(item_int["date"])

            best_match_idx = -1
            best_match_score = 0.0
            
            for idx, item_2b in enumerate(unreconciled_gstr2b):
                amt_2b = Decimal(str(item_2b["amount"]))
                vendor_2b = item_2b["vendor_name"]
                date_2b = datetime.fromisoformat(item_2b["date"])

                # Criteria 1: Numeric correlation (amount difference check)
                amt_diff = abs(amt_int - amt_2b)
                # Criteria 2: Date window drift
                days_diff = abs((date_int - date_2b).days)

                if days_diff <= time_window_days:
                    # Criteria 3: Fuzzy string score on vendor name
                    vendor_sim = string_similarity(vendor_int, vendor_2b)
                    
                    # Compute composite match score
                    score = vendor_sim
                    if amt_diff == 0:
                        score += 0.5
                    else:
                        score -= float(amt_diff / amt_int) * 0.5

                    if score > best_match_score:
                        best_match_score = score
                        best_match_idx = idx

            # If match exceeds similarity parameters
            if best_match_score >= self.similarity_threshold and best_match_idx != -1:
                matched_item_2b = unreconciled_gstr2b.pop(best_match_idx)
                unreconciled_internal.remove(item_int)

                match_entry = {
                    "internal_id": item_int["id"],
                    "gstr2b_id": matched_item_2b["id"],
                    "vendor_name": vendor_int,
                    "amount": float(amt_int),
                    "match_confidence": best_match_score
                }

                # Flag discrepancies in exact calculations (e.g. CGST/SGST splitting error)
                tax_int = Decimal(str(item_int.get("tax_amount", 0)))
                tax_2b = Decimal(str(matched_item_2b.get("tax_amount", 0)))
                
                if abs(tax_int - tax_2b) > Decimal("0.05"):
                    match_entry["discrepancy"] = f"Tax calculation mismatch: Internal ₹{tax_int} vs Portal ₹{tax_2b}"
                    discrepancies.append(match_entry)
                else:
                    matched.append(match_entry)

        unmatched = unreconciled_internal + unreconciled_gstr2b
        logger.info("itc_reconciliation_complete", matched=len(matched), discrepancies=len(discrepancies), unmatched=len(unmatched))
        return matched, discrepancies, unmatched


# ─── Corporate Filing Payload Generator ──────────────────────────────────────

class TaxOrchestrator:
    """
    Orchestrates live HSN code resolution, tax splitting, and returns payload compiler.
    """
    def __init__(self):
        self.tax_engine = TaxEngine()
        self.itc_optimizer = ITCOptimizer()

    def resolve_hsn_code(self, item_description: str) -> str:
        """Heuristics rules to auto-resolve HSN/SAC codes based on item descriptions."""
        desc_lower = item_description.lower()
        if "software" in desc_lower or "cloud" in desc_lower or "saas" in desc_lower:
            return "9983"  # IT services
        elif "audit" in desc_lower or "consulting" in desc_lower or "advocate" in desc_lower:
            return "9971"  # Financial/Legal services
        elif "computer" in desc_lower or "laptop" in desc_lower or "server" in desc_lower:
            return "8471"  # Hardware
        elif "mobile" in desc_lower or "phone" in desc_lower:
            return "8517"  # Telecom
        elif "manufacturing" in desc_lower:
            return "9988"  # Job Work
        elif "restaurant" in desc_lower or "meal" in desc_lower or "food" in desc_lower:
            return "9963"  # Catering/Restaurant
        return "9985"  # General support services

    def calculate_invoice_split(
        self, description: str, quantity: int, unit_price: float, supply_type: str, tx_type: str
    ) -> Dict[str, Any]:
        """Runs the rule engine and splits calculations to CGST, SGST, or IGST."""
        hsn = self.resolve_hsn_code(description)
        line = TaxLineItem(
            hsn_code=hsn,
            description=description,
            quantity=quantity,
            unit_price=Decimal(str(unit_price)),
            supply_type=SupplyType(supply_type.upper()),
            transaction_type=TransactionType(tx_type.upper())
        )
        tax = self.tax_engine.compute_tax(line)
        return {
            "hsn_code": tax.hsn_code,
            "taxable_value": float(tax.taxable_value),
            "slab": float(tax.slab_percent),
            "cgst": float(tax.cgst),
            "sgst": float(tax.sgst),
            "igst": float(tax.igst),
            "cess": float(tax.cess),
            "total_tax": float(tax.total_tax),
            "total_with_tax": float(tax.total_with_tax),
            "itc_eligible": tax.itc_eligible
        }

    def generate_form_24q_26q(self, tds_transactions: List[Dict[str, Any]], period: str) -> Dict[str, Any]:
        """
        Generates structured Quarterly TDS Returns payload (Form 24Q for Salaries, Form 26Q for Non-Salaries).
        """
        challans = []
        deductees = []
        total_tds = Decimal("0")

        for idx, tx in enumerate(tds_transactions):
            amt = Decimal(str(tx["amount"]))
            section = tx.get("tds_section", "194C")  # Contract payment default
            
            # Rate determination by section
            rate = Decimal("0.02")  # 2% standard contract
            if section == "194J":  # Professional fees
                rate = Decimal("0.10")  # 10%
            elif section == "192":  # Salary
                rate = Decimal("0.15")  # Average tax slab
                
            tds_deducted = (amt * rate).quantize(Decimal("1.00"), rounding=ROUND_HALF_UP)
            total_tds += tds_deducted

            deductees.append({
                "deductee_code": f"DED-{idx+1:04d}",
                "pan": tx.get("pan", "APBPV1234K"),
                "name": tx["vendor_name"],
                "section": section,
                "date_of_payment": tx["date"],
                "amount_paid": float(amt),
                "tds_deducted": float(tds_deducted),
                "date_of_deduction": tx["date"]
            })

        # Challenger reference challan record
        challans.append({
            "challan_no": "CHL-998811",
            "bsr_code": "0210099",
            "date_of_deposit": datetime.now().strftime("%Y-%m-%d"),
            "amount": float(total_tds),
            "interest": 0.0,
            "fees": 0.0,
            "total_tax_deposited": float(total_tds)
        })

        return {
            "deductor_tan": "BLRE04431B",
            "quarter": f"Q{((datetime.now().month-1)//3)+1}",
            "financial_year": f"{datetime.now().year}-{str(datetime.now().year+1)[2:]}",
            "period": period,
            "challan_records": challans,
            "deductee_records": deductees,
            "total_tds_aggregate": float(total_tds)
        }

    def generate_itr6_payload(self, financial_statements: Dict[str, Any], corporate_profile: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generates annual Corporate Income Tax Returns JSON payload (ITR-6).
        """
        balance_sheet = financial_statements.get("balance_sheet", {})
        pl_statement = financial_statements.get("profit_loss", {})

        return {
            "itr_type": "ITR-6",
            "assessment_year": f"{datetime.now().year}-{str(datetime.now().year+1)[2:]}",
            "company_details": {
                "name": corporate_profile.get("company_name", "ESHODHA FINTECH SOLUTIONS PRIVATE LIMITED"),
                "pan": corporate_profile.get("company_pan", "AAACE8891P"),
                "cin": corporate_profile.get("cin", "U72200KA2026PTC188200"),
                "registered_office_address": corporate_profile.get("address", "Bengaluru, Karnataka, India")
            },
            "schedule_bs": {
                "shareholders_funds": {
                    "share_capital": float(balance_sheet.get("share_capital", 1000000.0)),
                    "reserves_surplus": float(balance_sheet.get("retained_earnings", 2450000.0))
                },
                "non_current_liabilities": {
                    "long_term_borrowings": float(balance_sheet.get("long_term_loans", 500000.0))
                },
                "current_liabilities": {
                    "trade_payables": float(balance_sheet.get("accounts_payable", 120000.0)),
                    "other_current_liabilities": float(balance_sheet.get("accrued_liabilities", 45000.0))
                },
                "assets": {
                    "fixed_assets": float(balance_sheet.get("fixed_assets", 1250000.0)),
                    "current_assets": {
                        "cash_and_bank": float(balance_sheet.get("cash_and_cash_equivalents", 2325000.0)),
                        "trade_receivables": float(balance_sheet.get("accounts_receivable", 540000.0))
                    }
                }
            },
            "schedule_pl": {
                "revenue_from_operations": float(pl_statement.get("revenue", 12500000.0)),
                "expenses": {
                    "cost_of_materials": float(pl_statement.get("cost_of_goods_sold", 4500000.0)),
                    "employee_benefits_expense": float(pl_statement.get("salaries", 3500000.0)),
                    "finance_costs": float(pl_statement.get("interest_expenses", 25000.0)),
                    "other_expenses": float(pl_statement.get("operational_expenses", 1500000.0))
                },
                "profit_before_tax": float(pl_statement.get("net_income_before_tax", 2975000.0)),
                "tax_expenses": float(pl_statement.get("income_tax_expense", 743750.0))
            }
        }

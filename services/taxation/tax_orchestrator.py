"""
Credit Line Fintech Solution — Phase 13: Sovereign Tax Orchestration Engine.

Automates GST calculations, HSN resolution, Input Tax Credit (ITC) reconciliation
using fuzzy Levenshtein vendor name string distance, and GSTR-1/GSTR-3B payload generation.
Validated with pydantic schemas.
"""

from __future__ import annotations

import hashlib
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional, Tuple
from enum import Enum

from pydantic import BaseModel, Field, field_validator, ValidationInfo
import structlog

logger = structlog.get_logger(__name__)


# ─── Pydantic Validation Schemas ──────────────────────────────────────────

class SupplyTypeEnum(str, Enum):
    INTRASTATE = "INTRASTATE"
    INTERSTATE = "INTERSTATE"
    EXPORT = "EXPORT"
    SEZ = "SEZ"


class TransactionTypeEnum(str, Enum):
    SALE = "SALE"
    PURCHASE = "PURCHASE"
    CREDIT_NOTE = "CREDIT_NOTE"
    DEBIT_NOTE = "DEBIT_NOTE"


class TransactionItem(BaseModel):
    """Input transaction line item details validated via Pydantic."""
    description: str = Field(..., min_length=2, description="Line item description text")
    quantity: int = Field(..., gt=0, description="Quantity purchased or sold")
    unit_price: Decimal = Field(..., gt=0, description="Unit price before tax")
    discount: Decimal = Field(default=Decimal("0.0"), ge=0, description="Discount amount applied")
    supply_type: SupplyTypeEnum = Field(default=SupplyTypeEnum.INTRASTATE)
    transaction_type: TransactionTypeEnum = Field(default=TransactionTypeEnum.SALE)
    hsn_code: Optional[str] = Field(default=None, description="Optional pre-assigned HSN/SAC code")


class GSTRReconciliationItem(BaseModel):
    """Transaction schema for GSTR-2B matching."""
    id: str
    vendor_name: str
    amount: Decimal
    tax_amount: Decimal
    date: str

    @field_validator("date")
    @classmethod
    def validate_date_format(cls, v: str) -> str:
        try:
            datetime.fromisoformat(v)
        except ValueError:
            raise ValueError("Date must be in ISO-8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)")
        return v


# ─── Fuzzy String Distance (Levenshtein) Helper ─────────────────────────────

def levenshtein_distance(s1: str, s2: str) -> int:
    """Computes Levenshtein distance between two strings."""
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


# ─── Sovereign Tax Orchestration Class ───────────────────────────────────────

class SovereignTaxOrchestrator:
    """
    Automated tax engine responsible for HSN/SAC mapping, localized tax calculations
    (CGST/SGST/IGST), GSTR-2B reconciliation, and portal payload construction.
    """

    def __init__(self, reconciliation_threshold: float = 0.82):
        self.reconciliation_threshold = reconciliation_threshold
        # Official GST Rate Slabs
        self.gst_slabs = {
            "9983": Decimal("0.18"),  # SaaS / Software / IT - 18%
            "9971": Decimal("0.18"),  # Financial / Consultancy - 18%
            "8471": Decimal("0.12"),  # Hardware / Server - 12%
            "8517": Decimal("0.18"),  # Telecom - 18%
            "9988": Decimal("0.05"),  # Job work / Manufacturing - 5%
            "9963": Decimal("0.05"),  # Catering / Food - 5% (without input credit)
            "9985": Decimal("0.18"),  # General services - 18%
        }

    def resolve_hsn_code(self, item_description: str) -> str:
        """Auto-assigns HSN/SAC codes based on item descriptions."""
        desc = item_description.lower()
        if any(w in desc for w in ("software", "cloud", "saas", "api", "license")):
            return "9983"
        elif any(w in desc for w in ("consult", "audit", "legal", "advisory")):
            return "9971"
        elif any(w in desc for w in ("computer", "laptop", "server", "hardware", "router")):
            return "8471"
        elif any(w in desc for w in ("phone", "telecom", "mobile", "network")):
            return "8517"
        elif "manufacturing" in desc or "production" in desc:
            return "9988"
        elif any(w in desc for w in ("food", "catering", "restaurant", "meal")):
            return "9963"
        return "9985"  # General fallback

    def compute_tax_breakdown(self, item: TransactionItem) -> Dict[str, Any]:
        """
        Computes tax splits (CGST, SGST, IGST) based on resolved HSN and supply type.
        Supports standard GST split scales (5%, 12%, 18%, 28%).
        """
        hsn = item.hsn_code or self.resolve_hsn_code(item.description)
        rate = self.gst_slabs.get(hsn, Decimal("0.18"))  # default to 18%

        taxable_value = (item.quantity * item.unit_price) - item.discount
        if taxable_value < 0:
            taxable_value = Decimal("0.0")

        total_tax = (taxable_value * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        cgst = Decimal("0.0")
        sgst = Decimal("0.0")
        igst = Decimal("0.0")

        if item.supply_type == SupplyTypeEnum.INTRASTATE:
            # Split tax between state and central governments
            cgst = (total_tax / 2).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            sgst = (total_tax - cgst).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        elif item.supply_type in (SupplyTypeEnum.INTERSTATE, SupplyTypeEnum.SEZ):
            igst = total_tax
        # Exports are generally zero-rated
        elif item.supply_type == SupplyTypeEnum.EXPORT:
            total_tax = Decimal("0.0")

        itc_eligible = item.transaction_type == TransactionTypeEnum.PURCHASE and hsn != "9963"

        return {
            "hsn_code": hsn,
            "taxable_value": float(taxable_value),
            "rate_percent": float(rate * 100),
            "cgst": float(cgst),
            "sgst": float(sgst),
            "igst": float(igst),
            "cess": 0.0,
            "total_tax": float(total_tax),
            "total_with_tax": float(taxable_value + total_tax),
            "itc_eligible": itc_eligible
        }

    def reconcile_itc(
        self, internal_register: List[Dict[str, Any]], gstr_2b: List[Dict[str, Any]], date_window_days: int = 7
    ) -> Dict[str, Any]:
        """
        Reconciles input tax credit using transaction-hash mapping and fuzzy vendor name matching.
        """
        # Validate elements via pydantic
        internal_models = [GSTRReconciliationItem(**x) for x in internal_register]
        gstr2b_models = [GSTRReconciliationItem(**x) for x in gstr_2b]

        matched = []
        discrepancies = []
        unreconciled_internal = list(internal_models)
        unreconciled_gstr2b = list(gstr2b_models)

        for item_int in list(unreconciled_internal):
            best_match_idx = -1
            best_match_score = 0.0

            for idx, item_2b in enumerate(unreconciled_gstr2b):
                # Date window validation
                date_int = datetime.fromisoformat(item_int.date)
                date_2b = datetime.fromisoformat(item_2b.date)
                days_diff = abs((date_int - date_2b).days)

                if days_diff <= date_window_days:
                    # Fuzzy match on vendor strings
                    vendor_sim = string_similarity(item_int.vendor_name, item_2b.vendor_name)
                    
                    # Exact transaction hash match increases weight
                    hash_int = hashlib.sha256(f"{item_int.vendor_name.upper()}|{item_int.amount:.2f}".encode()).hexdigest()
                    hash_2b = hashlib.sha256(f"{item_2b.vendor_name.upper()}|{item_2b.amount:.2f}".encode()).hexdigest()
                    
                    score = vendor_sim
                    if hash_int == hash_2b:
                        score += 0.5

                    # Amount divergence weight penalty
                    amt_diff = abs(item_int.amount - item_2b.amount)
                    if amt_diff > 0:
                        score -= float(amt_diff / item_int.amount) * 0.5

                    if score > best_match_score:
                        best_match_score = score
                        best_match_idx = idx

            if best_match_score >= self.reconciliation_threshold and best_match_idx != -1:
                item_2b = unreconciled_gstr2b.pop(best_match_idx)
                unreconciled_internal.remove(item_int)

                match_record = {
                    "internal_id": item_int.id,
                    "gstr2b_id": item_2b.id,
                    "vendor_name": item_int.vendor_name,
                    "amount": float(item_int.amount),
                    "match_confidence": round(best_match_score, 4),
                }

                # Verify exact tax amounts
                if abs(item_int.tax_amount - item_2b.tax_amount) > Decimal("0.05"):
                    match_record["discrepancy"] = f"Tax calculation mismatch: Internal ₹{item_int.tax_amount} vs Portal ₹{item_2b.tax_amount}"
                    discrepancies.append(match_record)
                else:
                    matched.append(match_record)

        unmatched_records = (
            [{"source": "internal", "data": x.model_dump()} for x in unreconciled_internal] +
            [{"source": "gstr2b", "data": x.model_dump()} for x in unreconciled_gstr2b]
        )

        return {
            "matched_count": len(matched),
            "discrepancy_count": len(discrepancies),
            "unmatched_count": len(unmatched_records),
            "matched": matched,
            "discrepancies": discrepancies,
            "unmatched": unmatched_records
        }

    def generate_filing_payloads(self, gstin: str, period: str, items: List[TransactionItem]) -> Dict[str, Any]:
        """
        Generates schema-compliant JSON payloads for GST Return filing (GSTR-1 and GSTR-3B).
        """
        total_taxable = Decimal("0.0")
        total_cgst = Decimal("0.0")
        total_sgst = Decimal("0.0")
        total_igst = Decimal("0.0")
        total_tax = Decimal("0.0")
        itc_available = Decimal("0.0")

        b2b_invoices = []

        for idx, item in enumerate(items):
            tax = self.compute_tax_breakdown(item)
            total_taxable += Decimal(str(tax["taxable_value"]))
            total_cgst += Decimal(str(tax["cgst"]))
            total_sgst += Decimal(str(tax["sgst"]))
            total_igst += Decimal(str(tax["igst"]))
            total_tax += Decimal(str(tax["total_tax"]))
            
            if tax["itc_eligible"]:
                itc_available += Decimal(str(tax["total_tax"]))

            b2b_invoices.append({
                "inv_num": f"INV-2026-{idx+1:04d}",
                "inv_date": datetime.now().strftime("%Y-%m-%d"),
                "val": tax["total_with_tax"],
                "hsn": tax["hsn_code"],
                "tax_rate": tax["rate_percent"],
                "taxable_val": tax["taxable_value"],
                "cgst": tax["cgst"],
                "sgst": tax["sgst"],
                "igst": tax["igst"],
            })

        # GSTR-1 Payload Construction (Outward Supplies)
        gstr1_payload = {
            "gstin": gstin,
            "ret_period": period,
            "b2b": [
                {
                    "ctin": "29RECVR9876A1Z3",  # Mock counterparty GSTIN
                    "inv": b2b_invoices
                }
            ],
            "total_taxable_value": float(total_taxable),
            "total_tax_liability": float(total_tax)
        }

        # GSTR-3B Payload Construction (Summary Return & Tax Payment)
        gstr3b_payload = {
            "gstin": gstin,
            "ret_period": period,
            "sup_details": {
                "osup_det": {
                    "txval": float(total_taxable),
                    "iamt": float(total_igst),
                    "camt": float(total_cgst),
                    "samt": float(total_sgst),
                    "csamt": 0.0
                }
            },
            "itc_elg": {
                "itc_avl": [
                    {
                        "ty": "ALL_OTHER_ITC",
                        "iamt": float(itc_available if total_igst > 0 else 0.0),
                        "camt": float(itc_available / 2 if total_cgst > 0 else 0.0),
                        "samt": float(itc_available / 2 if total_sgst > 0 else 0.0),
                        "csamt": 0.0
                    }
                ]
            },
            "tx_pmt": {
                "paid_cash": float(max(Decimal("0"), total_tax - itc_available)),
                "paid_itc": float(min(total_tax, itc_available))
            }
        }

        return {
            "gstr1": gstr1_payload,
            "gstr3b": gstr3b_payload,
            "summary": {
                "total_taxable": float(total_taxable),
                "total_tax": float(total_tax),
                "itc_available": float(itc_available),
                "net_payable": float(max(Decimal("0"), total_tax - itc_available))
            }
        }


# Compatibility Class Wrapper
class TaxOrchestrator(SovereignTaxOrchestrator):
    """Compatibility subclass mapping to the legacy class name."""
    pass

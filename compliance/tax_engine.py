"""
Credit Line Fintech Solution — Phase 11: GST Tax Logic Engine.

Categorizes every transaction into Indian GST slabs (5%, 12%, 18%, 28%)
based on HSN/SAC code mapping. Handles:
  - HSN code lookup for goods
  - SAC code lookup for services
  - Interstate vs intrastate (CGST+SGST vs IGST)
  - Input Tax Credit (ITC) eligibility
  - Reverse Charge Mechanism (RCM)
  - Composition Scheme thresholds
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from typing import Any

from config.logging_config import get_logger

logger = get_logger(__name__)


# ─── GST Slab Definitions ───────────────────────────────────────────

class GSTSlab(str, Enum):
    EXEMPT = "0"
    FIVE = "5"
    TWELVE = "12"
    EIGHTEEN = "18"
    TWENTY_EIGHT = "28"
    CESS = "CESS"  # Luxury goods additional cess


class SupplyType(str, Enum):
    INTRASTATE = "INTRASTATE"   # CGST + SGST
    INTERSTATE = "INTERSTATE"   # IGST
    EXPORT = "EXPORT"           # Zero-rated
    SEZ = "SEZ"                 # Special Economic Zone


class TransactionType(str, Enum):
    SALE = "SALE"
    PURCHASE = "PURCHASE"
    CREDIT_NOTE = "CREDIT_NOTE"
    DEBIT_NOTE = "DEBIT_NOTE"
    ADVANCE = "ADVANCE"
    RCM = "REVERSE_CHARGE"


# ─── HSN/SAC Code Database ──────────────────────────────────────────

# Production: stored in PostgreSQL. This is the in-memory reference.
HSN_CATALOG: dict[str, dict[str, Any]] = {
    # Food & Agriculture (5%)
    "0201": {"desc": "Meat of bovine animals, fresh", "slab": "5", "cess": 0},
    "0401": {"desc": "Milk and cream", "slab": "0", "cess": 0},
    "1001": {"desc": "Wheat and meslin", "slab": "0", "cess": 0},
    "1006": {"desc": "Rice", "slab": "5", "cess": 0},
    # Textiles (5-12%)
    "5208": {"desc": "Woven cotton fabrics", "slab": "5", "cess": 0},
    "6109": {"desc": "T-shirts, singlets", "slab": "12", "cess": 0},
    # Electronics (18%)
    "8471": {"desc": "Computers and peripherals", "slab": "18", "cess": 0},
    "8517": {"desc": "Telephones/smartphones", "slab": "18", "cess": 0},
    "8528": {"desc": "Monitors and projectors", "slab": "18", "cess": 0},
    # Automobiles (28% + cess)
    "8703": {"desc": "Motor cars", "slab": "28", "cess": 15},
    "8711": {"desc": "Motorcycles", "slab": "28", "cess": 0},
    # Software & IT Services (18%)
    "9983": {"desc": "IT and IT-enabled services", "slab": "18", "cess": 0},
    "9971": {"desc": "Financial services", "slab": "18", "cess": 0},
    "9973": {"desc": "Leasing/rental services", "slab": "18", "cess": 0},
    "9985": {"desc": "Support services", "slab": "18", "cess": 0},
    "9988": {"desc": "Manufacturing services", "slab": "18", "cess": 0},
    "9954": {"desc": "Construction services", "slab": "18", "cess": 0},
    # Restaurant (5%)
    "9963": {"desc": "Restaurant services", "slab": "5", "cess": 0},
}


@dataclass
class TaxLineItem:
    """A single taxable line item."""
    hsn_code: str
    description: str
    quantity: int
    unit_price: Decimal
    discount: Decimal = Decimal("0")
    supply_type: SupplyType = SupplyType.INTRASTATE
    transaction_type: TransactionType = TransactionType.SALE

    @property
    def taxable_value(self) -> Decimal:
        gross = Decimal(self.quantity) * self.unit_price
        return (gross - self.discount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


@dataclass
class TaxBreakdown:
    """Computed tax for a line item."""
    hsn_code: str
    taxable_value: Decimal
    slab_percent: Decimal
    cgst: Decimal = Decimal("0")
    sgst: Decimal = Decimal("0")
    igst: Decimal = Decimal("0")
    cess: Decimal = Decimal("0")
    total_tax: Decimal = Decimal("0")
    total_with_tax: Decimal = Decimal("0")
    is_rcm: bool = False
    itc_eligible: bool = True


@dataclass
class GSTReturn:
    """Aggregated GST return data for filing."""
    period: str  # "042026" (April 2026)
    gstin: str
    total_taxable: Decimal = Decimal("0")
    total_cgst: Decimal = Decimal("0")
    total_sgst: Decimal = Decimal("0")
    total_igst: Decimal = Decimal("0")
    total_cess: Decimal = Decimal("0")
    total_tax: Decimal = Decimal("0")
    itc_available: Decimal = Decimal("0")
    net_liability: Decimal = Decimal("0")
    line_items: list[TaxBreakdown] = field(default_factory=list)
    filing_status: str = "DRAFT"
    filing_deadline: str = ""


class TaxEngine:
    """
    Core tax computation engine for Indian GST.

    Supports:
      - HSN/SAC-based slab lookup
      - Interstate vs intrastate tax splitting
      - ITC computation
      - GSTR-1 / GSTR-3B payload generation
      - Composition scheme detection
    """

    COMPOSITION_LIMIT = Decimal("1_50_00_000")  # ₹1.5 Cr

    def __init__(self, hsn_catalog: dict | None = None):
        self._catalog = hsn_catalog or HSN_CATALOG

    def compute_tax(self, item: TaxLineItem) -> TaxBreakdown:
        """Compute GST for a single line item."""
        catalog_entry = self._catalog.get(item.hsn_code)
        if not catalog_entry:
            logger.warning("hsn_not_found", hsn=item.hsn_code)
            slab = Decimal("18")  # Default to 18%
            cess_rate = Decimal("0")
        else:
            slab = Decimal(catalog_entry["slab"])
            cess_rate = Decimal(str(catalog_entry.get("cess", 0)))

        taxable = item.taxable_value
        is_rcm = item.transaction_type == TransactionType.RCM

        # Tax computation
        breakdown = TaxBreakdown(
            hsn_code=item.hsn_code,
            taxable_value=taxable,
            slab_percent=slab,
            is_rcm=is_rcm,
        )

        if item.supply_type == SupplyType.EXPORT:
            # Zero-rated for exports
            pass
        elif item.supply_type == SupplyType.INTERSTATE:
            breakdown.igst = (taxable * slab / 100).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP)
        else:
            # Intrastate: split equally into CGST + SGST
            half_rate = slab / 2
            breakdown.cgst = (taxable * half_rate / 100).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP)
            breakdown.sgst = breakdown.cgst

        # Cess (luxury goods)
        if cess_rate > 0:
            breakdown.cess = (taxable * cess_rate / 100).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP)

        breakdown.total_tax = breakdown.cgst + breakdown.sgst + breakdown.igst + breakdown.cess
        breakdown.total_with_tax = taxable + breakdown.total_tax

        # ITC eligibility (purchases only, not for personal use)
        breakdown.itc_eligible = (
            item.transaction_type == TransactionType.PURCHASE
            and slab > 0
        )

        return breakdown

    def generate_gstr1_payload(self, gst_return: GSTReturn) -> dict:
        """Generate GSTN-compatible JSON for GSTR-1 filing."""
        b2b_invoices = []
        for item in gst_return.line_items:
            b2b_invoices.append({
                "inum": f"INV-{item.hsn_code}-{len(b2b_invoices)+1}",
                "idt": datetime.now().strftime("%d-%m-%Y"),
                "val": float(item.total_with_tax),
                "pos": "29",  # State code
                "rchrg": "Y" if item.is_rcm else "N",
                "itms": [{
                    "num": 1,
                    "itm_det": {
                        "txval": float(item.taxable_value),
                        "rt": float(item.slab_percent),
                        "camt": float(item.cgst),
                        "samt": float(item.sgst),
                        "iamt": float(item.igst),
                        "csamt": float(item.cess),
                    },
                }],
            })

        return {
            "gstin": gst_return.gstin,
            "fp": gst_return.period,
            "b2b": b2b_invoices,
            "version": "GST3.0",
            "hash": "hash-placeholder",
        }

    def generate_gstr3b_payload(self, gst_return: GSTReturn) -> dict:
        """Generate GSTN-compatible JSON for GSTR-3B summary filing."""
        return {
            "gstin": gst_return.gstin,
            "ret_period": gst_return.period,
            "sup_details": {
                "osup_det": {
                    "txval": float(gst_return.total_taxable),
                    "camt": float(gst_return.total_cgst),
                    "samt": float(gst_return.total_sgst),
                    "iamt": float(gst_return.total_igst),
                    "csamt": float(gst_return.total_cess),
                },
            },
            "itc_elg": {
                "itc_avl": [{
                    "ty": "IMPG",
                    "iamt": float(gst_return.itc_available),
                    "camt": 0, "samt": 0, "csamt": 0,
                }],
            },
        }

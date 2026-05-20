"""
eshodha fintech solution — Phase 11: Bank Reconciliation Engine.

Automated matching of internal ledger entries against bank statements.
Supports:
  - Exact match (amount + date + reference)
  - Fuzzy match (amount ± tolerance, date ± 3 days)
  - Unmatched detection (missing in bank / missing in books)
  - Auto-reconciliation with confidence scoring
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from typing import Any

from config.logging_config import get_logger

logger = get_logger(__name__)


class MatchStatus(str, Enum):
    MATCHED = "MATCHED"
    PARTIAL = "PARTIAL_MATCH"
    UNMATCHED_BOOKS = "UNMATCHED_IN_BOOKS"   # In bank, not in books
    UNMATCHED_BANK = "UNMATCHED_IN_BANK"     # In books, not in bank
    DUPLICATE = "POTENTIAL_DUPLICATE"


@dataclass
class LedgerEntry:
    entry_id: str
    date: date
    description: str
    amount: Decimal
    reference: str = ""
    category: str = ""
    matched: bool = False


@dataclass
class BankEntry:
    entry_id: str
    date: date
    description: str
    amount: Decimal
    reference: str = ""
    balance: Decimal = Decimal("0")
    matched: bool = False


@dataclass
class ReconciliationResult:
    ledger_id: str | None
    bank_id: str | None
    status: MatchStatus
    confidence: float
    amount_diff: Decimal = Decimal("0")
    date_diff_days: int = 0
    notes: str = ""


@dataclass
class ReconciliationReport:
    period: str
    total_ledger: int = 0
    total_bank: int = 0
    matched: int = 0
    partial: int = 0
    unmatched_books: int = 0
    unmatched_bank: int = 0
    match_rate: float = 0.0
    discrepancy_amount: Decimal = Decimal("0")
    results: list[ReconciliationResult] = field(default_factory=list)


class ReconciliationEngine:
    """
    Automated bank reconciliation with multi-pass matching.

    Pass 1: Exact match (amount + reference)
    Pass 2: Amount match within tolerance (± ₹1)
    Pass 3: Fuzzy match (amount ± 5%, date ± 3 days)
    """

    def __init__(
        self,
        amount_tolerance: Decimal = Decimal("1.00"),
        date_tolerance_days: int = 3,
        fuzzy_amount_pct: float = 0.05,
    ):
        self.amount_tolerance = amount_tolerance
        self.date_tolerance = timedelta(days=date_tolerance_days)
        self.fuzzy_pct = fuzzy_amount_pct

    def reconcile(
        self,
        ledger: list[LedgerEntry],
        bank: list[BankEntry],
        period: str = "",
    ) -> ReconciliationReport:
        """Run multi-pass reconciliation."""
        report = ReconciliationReport(
            period=period,
            total_ledger=len(ledger),
            total_bank=len(bank),
        )

        # Reset match flags
        for e in ledger:
            e.matched = False
        for e in bank:
            e.matched = False

        # Pass 1: Exact match
        for le in ledger:
            if le.matched:
                continue
            for be in bank:
                if be.matched:
                    continue
                if le.amount == be.amount and le.reference and le.reference == be.reference:
                    le.matched = True
                    be.matched = True
                    report.results.append(ReconciliationResult(
                        ledger_id=le.entry_id, bank_id=be.entry_id,
                        status=MatchStatus.MATCHED, confidence=1.0,
                    ))
                    report.matched += 1
                    break

        # Pass 2: Amount match with tolerance
        for le in ledger:
            if le.matched:
                continue
            for be in bank:
                if be.matched:
                    continue
                diff = abs(le.amount - be.amount)
                if diff <= self.amount_tolerance and abs((le.date - be.date).days) <= 1:
                    le.matched = True
                    be.matched = True
                    report.results.append(ReconciliationResult(
                        ledger_id=le.entry_id, bank_id=be.entry_id,
                        status=MatchStatus.MATCHED, confidence=0.95,
                        amount_diff=diff,
                        date_diff_days=abs((le.date - be.date).days),
                    ))
                    report.matched += 1
                    break

        # Pass 3: Fuzzy match
        for le in ledger:
            if le.matched:
                continue
            best_match = None
            best_confidence = 0.0
            for be in bank:
                if be.matched:
                    continue
                amt_diff = abs(le.amount - be.amount)
                amt_pct = float(amt_diff / max(le.amount, Decimal("1")))
                date_diff = abs((le.date - be.date).days)

                if amt_pct <= self.fuzzy_pct and date_diff <= self.date_tolerance.days:
                    confidence = 1.0 - (amt_pct * 5) - (date_diff * 0.05)
                    if confidence > best_confidence and confidence >= 0.6:
                        best_match = be
                        best_confidence = confidence

            if best_match:
                le.matched = True
                best_match.matched = True
                report.results.append(ReconciliationResult(
                    ledger_id=le.entry_id, bank_id=best_match.entry_id,
                    status=MatchStatus.PARTIAL, confidence=round(best_confidence, 3),
                    amount_diff=abs(le.amount - best_match.amount),
                    date_diff_days=abs((le.date - best_match.date).days),
                ))
                report.partial += 1

        # Unmatched entries
        for le in ledger:
            if not le.matched:
                report.results.append(ReconciliationResult(
                    ledger_id=le.entry_id, bank_id=None,
                    status=MatchStatus.UNMATCHED_BANK, confidence=0.0,
                    notes=f"₹{le.amount} on {le.date} not found in bank statement",
                ))
                report.unmatched_bank += 1
                report.discrepancy_amount += le.amount

        for be in bank:
            if not be.matched:
                report.results.append(ReconciliationResult(
                    ledger_id=None, bank_id=be.entry_id,
                    status=MatchStatus.UNMATCHED_BOOKS, confidence=0.0,
                    notes=f"₹{be.amount} on {be.date} not found in internal ledger",
                ))
                report.unmatched_books += 1
                report.discrepancy_amount += be.amount

        total = report.total_ledger + report.total_bank
        if total > 0:
            report.match_rate = round(
                (report.matched * 2 + report.partial) / total * 100, 1
            )

        logger.info(
            "reconciliation_complete",
            period=period,
            matched=report.matched,
            partial=report.partial,
            unmatched=report.unmatched_bank + report.unmatched_books,
            match_rate=report.match_rate,
        )

        return report

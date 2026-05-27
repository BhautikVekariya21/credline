"""
Credit Line Fintech Solution — Phase 14: Agentic Negotiation & Budget Rebalancer.

Orchestrates autonomous actions triggered by liquidity oracle stress-testing,
drafting vendor outreach letters and formulating departmental cost cuts.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any


class NegotiationAgent:
    """
    Autonomous Strategy Agent that acts on liquidity forecasts to draft supplier
    negotiation messages and optimize capital allocation budgets.
    """
    def __init__(self):
        self.inbox_items: list[dict[str, Any]] = []
        self._initialize_default_inbox()

    def evaluate_liquidity_and_trigger(self, forecast_result: dict[str, Any], reserve_threshold: float = 1200000.0):
        """
        Check predictions from LiquidityOracle. If cash levels drop below
        the reserve threshold, queue corrective actions in the strategy inbox.
        """
        worst_case = forecast_result.get("worst_case", [])
        base_case = forecast_result.get("base_case", [])
        
        # Check if runway drops below reserve threshold
        crunch_day_worst = -1
        for idx, val in enumerate(worst_case):
            if val < reserve_threshold:
                crunch_day_worst = idx + 1
                break

        crunch_day_base = -1
        for idx, val in enumerate(base_case):
            if val < reserve_threshold:
                crunch_day_base = idx + 1
                break

        if crunch_day_worst != -1:
            # Trigger alert and auto-generate corrective actions
            trigger_day = crunch_day_base if crunch_day_base != -1 else crunch_day_worst
            self._queue_outreach_actions(trigger_day)
            self._queue_budget_rebalancing(trigger_day)
            return {
                "triggered": True,
                "crunch_day": trigger_day,
                "severity": "CRITICAL" if crunch_day_base != -1 else "WARNING",
                "message": f"Liquidity alert: Cash levels projected to drop below reserve threshold of INR {reserve_threshold:,.2f} on Day {trigger_day}."
            }
            
        return {"triggered": False, "message": "Liquidity remains within safe boundary margins."}

    def process_inbox_action(self, action_id: str, decision: str, custom_body: str | None = None) -> dict[str, Any]:
        """Approve, Reject, or Edit actions in the Agent Strategy Inbox."""
        for item in self.inbox_items:
            if item["id"] == action_id:
                if decision.upper() == "APPROVE":
                    item["status"] = "APPROVED"
                    item["processed_at"] = datetime.now().isoformat()
                    if custom_body:
                        item["email_body"] = custom_body
                    return {"success": True, "item": item, "message": "Action approved and scheduled for execution."}
                elif decision.upper() == "REJECT":
                    item["status"] = "REJECTED"
                    item["processed_at"] = datetime.now().isoformat()
                    return {"success": True, "item": item, "message": "Action rejected and archived."}
                elif decision.upper() == "UPDATE":
                    if custom_body:
                        item["email_body"] = custom_body
                    return {"success": True, "item": item, "message": "Draft revised successfully."}
                    
        return {"success": False, "message": f"Action ID {action_id} not found."}

    def _queue_outreach_actions(self, crunch_day: int):
        """Auto-draft outreach letters for non-critical supplier accounts."""
        # Clean existing pending vendor negotiations to avoid duplication
        self.inbox_items = [i for i in self.inbox_items if i["status"] != "PENDING" or i["type"] != "term_negotiation"]

        vendors = [
            {"name": "AWS Cloud Services India", "terms": "Net-30", "target_terms": "Net-60", "category": "Infrastructure"},
            {"name": "VND-CONSULT-004 (Tech Consultancy)", "terms": "Net-15", "target_terms": "Net-45", "category": "Professional Services"},
            {"name": "Global Office Solutions (Lease)", "terms": "Net-30", "target_terms": "Net-60", "category": "Rent & Facilities"}
        ]

        for v in vendors:
            item_id = f"NEG-{uuid.uuid4().hex[:6].upper()}"
            subject = f"Proposed Payment Terms Revision — Credit Line Solutions / {v['name']}"
            
            body = (
                f"Dear Accounts Payable Team,\n\n"
                f"I am writing on behalf of Credit Line Solutions regarding our current billing agreement under reference {item_id}.\n\n"
                f"In order to align our operational cycles and optimize working capital parameters for the upcoming fiscal quarter, "
                f"we would like to request an adjustment to our payment term window from {v['terms']} to {v['target_terms']}.\n\n"
                f"This change would take effect beginning with the invoice cycle due on Day {crunch_day}. "
                f"We value our relationship with {v['name']} and intend to maintain our consistent payment record under these updated parameters.\n\n"
                f"Please let us know if we can schedule a quick call to confirm these terms.\n\n"
                f"Best regards,\n"
                f"Credit Line Autonomous CFO & FP&A Team"
            )

            self.inbox_items.append({
                "id": item_id,
                "type": "term_negotiation",
                "status": "PENDING",
                "title": f"Extend terms for {v['name']}",
                "vendor": v["name"],
                "category": v["category"],
                "current_terms": v["terms"],
                "proposed_terms": v["target_terms"],
                "email_subject": subject,
                "email_body": body,
                "created_at": datetime.now().isoformat(),
                "processed_at": None
            })

    def _queue_budget_rebalancing(self, crunch_day: int):
        """Formulate specific departmental cost reductions."""
        # Clean existing pending budget recommendations
        self.inbox_items = [i for i in self.inbox_items if i["status"] != "PENDING" or i["type"] != "budget_rebalance"]

        item_id = f"BUD-{uuid.uuid4().hex[:6].upper()}"
        description = (
            f"Automated capital rebalancing recommended to offset liquidity drawdown expected on Day {crunch_day}.\n"
            f"Departmental spending limits will be revised inside the global Feast feature store / payment gateways."
        )

        cuts = [
            {"department": "Engineering / Cloud Services", "original": 4200000.0, "proposed": 3570000.0, "reduction_pct": 15.0, "action": "Enforce AWS container size limit"},
            {"department": "Marketing Campaigns", "original": 1800000.0, "proposed": 1440000.0, "reduction_pct": 20.0, "action": "Pause programmatic ads in US West"},
            {"department": "Sales & Travel", "original": 850000.0, "proposed": 425000.0, "reduction_pct": 50.0, "action": "Restrict offsite travel in Q3"},
            {"department": "Office Administration & Perks", "original": 500000.0, "proposed": 450000.0, "reduction_pct": 10.0, "action": "Defer hardware replacements"}
        ]

        self.inbox_items.append({
            "id": item_id,
            "type": "budget_rebalance",
            "status": "PENDING",
            "title": "Emergency Budget Rebalancing Plan",
            "description": description,
            "cuts": cuts,
            "total_savings": sum(c["original"] - c["proposed"] for c in cuts),
            "created_at": datetime.now().isoformat(),
            "processed_at": None
        })

    def _initialize_default_inbox(self):
        """Prefill a few items for dashboard visual setup."""
        # Add one completed item and one pending item to show initial Strategy Room setup
        self.inbox_items.append({
            "id": "NEG-INIT-01",
            "type": "term_negotiation",
            "status": "APPROVED",
            "title": "Extend terms for Vendor G-Solutions",
            "vendor": "G-Solutions (Office Spaces)",
            "category": "Rent & Facilities",
            "current_terms": "Net-30",
            "proposed_terms": "Net-60",
            "email_subject": "Proposed Payment Terms Revision — Credit Line Solutions / G-Solutions",
            "email_body": "Agreement updated successfully by CFO request.",
            "created_at": datetime.now().isoformat(),
            "processed_at": datetime.now().isoformat()
        })

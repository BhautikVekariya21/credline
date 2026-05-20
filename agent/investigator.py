"""
FinGuard 2026 — Investigator Agent.

LLM-powered investigation agent using LangChain that queries the
Neo4j graph, SHAP explanations, and decision history to provide
natural-language answers to analyst questions.

Architecture:
  ┌──────────────┐     ┌───────────────┐     ┌─────────────┐
  │  Analyst Q   │ ──► │  LLM Router   │ ──► │  Graph RAG  │
  └──────────────┘     │  (LangChain)  │     │  Neo4j      │
                       │               │ ──► │  SHAP Expl  │
                       │               │     │  Decisions   │
                       └───────────────┘     └─────────────┘
                              │
                              ▼
                       ┌───────────────┐
                       │  NL Response  │
                       └───────────────┘
"""

from __future__ import annotations

import json
import time
from typing import Any

from config.logging_config import get_logger

logger = get_logger(__name__)


# ─── Tool Definitions ───────────────────────────────────────────────────────


class GraphQueryTool:
    """Tool: queries Neo4j graph for entity relationships and risk data."""

    name = "graph_query"
    description = (
        "Query the Neo4j transaction graph to find connections between users, "
        "devices, IPs, and merchants. Use this when asked about fraud rings, "
        "connections, or graph relationships."
    )

    def __init__(self) -> None:
        from database.neo4j_client import Neo4jClient
        self.client = Neo4jClient()

    def run(self, query: str) -> str:
        """Parse analyst intent and run appropriate graph query."""
        query_lower = query.lower()

        if "connection" in query_lower or "ring" in query_lower or "hop" in query_lower:
            # Extract user ID from query
            user_id = self._extract_user_id(query)
            if user_id:
                result = self.client.get_risk_contagion(user_id)
                return json.dumps(result, indent=2, default=str)

        if "cycle" in query_lower or "laundering" in query_lower:
            result = self.client.detect_cycles()
            return json.dumps(result[:10], indent=2, default=str)

        if "neighbor" in query_lower or "network" in query_lower:
            user_id = self._extract_user_id(query)
            if user_id:
                result = self.client.get_user_neighborhood(user_id)
                return json.dumps(result, indent=2, default=str)

        return json.dumps({"message": "No matching graph query pattern found."})

    @staticmethod
    def _extract_user_id(text: str) -> str | None:
        import re
        match = re.search(r'USR-\w+', text, re.IGNORECASE)
        if match:
            return match.group(0).upper()
        match = re.search(r'user\s+(\w+)', text, re.IGNORECASE)
        return f"USR-{match.group(1)}" if match else None


class SHAPExplanationTool:
    """Tool: retrieves SHAP explanations for specific decisions."""

    name = "shap_explanation"
    description = (
        "Retrieve the SHAP-based explanation and reason codes for a "
        "specific fraud or credit decision. Use when asked WHY a user "
        "was flagged, denied, or scored in a certain way."
    )

    def run(self, query: str) -> str:
        import re

        decision_id = None
        match = re.search(r'(FRD|CRD|MEMO)-\w+', query)
        if match:
            decision_id = match.group(0)

        # Generate synthetic explanation for demo
        explanation = {
            "decision_id": decision_id or "FRD-unknown",
            "top_factors": [
                {"feature": "tx_velocity_1h", "impact": 0.32, "direction": "increased risk",
                 "narrative": "Transaction velocity in last hour was 3x above normal"},
                {"feature": "device_sharing_count", "impact": 0.21, "direction": "increased risk",
                 "narrative": "Device shared with 4 other users in last 24h"},
                {"feature": "geo_velocity_kmh", "impact": 0.18, "direction": "increased risk",
                 "narrative": "Impossible travel detected: 800km in 15 minutes"},
                {"feature": "merchant_risk_score", "impact": 0.12, "direction": "increased risk",
                 "narrative": "Merchant in high-risk category (cryptocurrency)"},
                {"feature": "account_age_days", "impact": -0.05, "direction": "decreased risk",
                 "narrative": "Account age of 730 days reduces risk slightly"},
            ],
        }
        return json.dumps(explanation, indent=2)


class SystemHealthTool:
    """Tool: queries system health and operational metrics."""

    name = "system_health"
    description = (
        "Check the health and performance metrics of the FinGuard platform. "
        "Use when asked about system status, latency, throughput, or errors."
    )

    def run(self, query: str) -> str:
        health = {
            "status": "healthy",
            "uptime_hours": 168.5,
            "api_latency_p99_ms": 42.3,
            "transactions_per_second": 4827,
            "models_loaded": ["graphsage", "transformer", "biometric", "ensemble", "xgboost"],
            "drift_status": "stable",
            "last_retrain": "2026-05-12T18:00:00Z",
            "active_alerts": 2,
        }
        return json.dumps(health, indent=2)


class DecisionHistoryTool:
    """Tool: queries past fraud/credit decisions for a user."""

    name = "decision_history"
    description = (
        "Look up past fraud or credit decisions for a specific user. "
        "Use when asked about a user's history, past flags, or trends."
    )

    def run(self, query: str) -> str:
        user_id = GraphQueryTool._extract_user_id(query)
        history = {
            "user_id": user_id or "USR-unknown",
            "total_decisions": 47,
            "fraud_flags": 3,
            "avg_fraud_score": 0.23,
            "credit_score_current": 672,
            "credit_score_trend": "improving",
            "recent_decisions": [
                {"id": "FRD-abc123", "type": "fraud", "score": 0.78, "risk": "high",
                 "timestamp": "2026-05-13T08:30:00Z"},
                {"id": "CRD-def456", "type": "credit", "score": 672, "risk": "medium",
                 "timestamp": "2026-05-12T14:00:00Z"},
            ],
        }
        return json.dumps(history, indent=2)


# ─── Investigator Agent ─────────────────────────────────────────────────────


class InvestigatorAgent:
    """
    LLM-powered investigation agent for fraud analysts.

    Uses LangChain-style tool routing to answer questions in
    natural language by querying the graph, SHAP explanations,
    and decision history.
    """

    def __init__(self, model_name: str = "llama3") -> None:
        self.model_name = model_name
        self.tools = {
            "graph_query": GraphQueryTool(),
            "shap_explanation": SHAPExplanationTool(),
            "system_health": SystemHealthTool(),
            "decision_history": DecisionHistoryTool(),
        }
        self._chain = None
        self._init_chain()

    def _init_chain(self) -> None:
        """Initialize LangChain agent chain."""
        try:
            from langchain.agents import AgentExecutor, create_react_agent
            from langchain.tools import Tool
            from langchain_community.llms import Ollama

            llm = Ollama(model=self.model_name)
            lc_tools = [
                Tool(
                    name=t.name,
                    func=t.run,
                    description=t.description,
                )
                for t in self.tools.values()
            ]

            from langchain.prompts import PromptTemplate

            template = """You are FinGuard Investigator, an AI assistant for fraud analysts.
You have access to the following tools:

{tools}

Use the following format:
Question: the input question
Thought: think about what tool to use
Action: the tool name
Action Input: the input to the tool
Observation: the result
... (repeat if needed)
Thought: I now know the answer
Final Answer: a clear, professional summary

Question: {input}
{agent_scratchpad}"""

            prompt = PromptTemplate(
                input_variables=["input", "tools", "tool_names", "agent_scratchpad"],
                template=template,
            )
            agent = create_react_agent(llm, lc_tools, prompt)
            self._chain = AgentExecutor(
                agent=agent, tools=lc_tools, verbose=True, max_iterations=5
            )
            logger.info("investigator_agent_initialized", model=self.model_name)

        except ImportError:
            logger.warning(
                "langchain_not_available",
                msg="Using rule-based fallback agent",
            )
        except Exception as e:
            logger.warning("agent_init_failed", error=str(e))

    def investigate(self, question: str) -> dict[str, Any]:
        """
        Process an analyst question and return structured answer.
        """
        start = time.time()

        # Try LangChain agent first
        if self._chain:
            try:
                result = self._chain.invoke({"input": question})
                return {
                    "question": question,
                    "answer": result.get("output", ""),
                    "source": "llm_agent",
                    "latency_ms": round((time.time() - start) * 1000, 1),
                }
            except Exception as e:
                logger.warning("llm_agent_failed", error=str(e))

        # Fallback: rule-based routing
        return self._rule_based_investigate(question, start)

    def _rule_based_investigate(
        self, question: str, start_time: float
    ) -> dict[str, Any]:
        """Rule-based fallback when LLM is unavailable."""
        q = question.lower()
        tool_key = None
        if any(w in q for w in ["flag", "why", "reason", "explain", "denied", "shap"]):
            tool_key = "shap_explanation"
        elif any(w in q for w in ["connect", "ring", "graph", "hop", "network", "link"]):
            tool_key = "graph_query"
        elif any(w in q for w in ["health", "status", "latency", "tps", "uptime"]):
            tool_key = "system_health"
        elif any(w in q for w in ["history", "past", "decision", "trend"]):
            tool_key = "decision_history"
        else:
            tool_key = "shap_explanation"

        tool = self.tools[tool_key]
        raw_result = tool.run(question)
        data = json.loads(raw_result)

        # Generate human-readable summary
        summary = self._summarize(tool_key, data, question)

        return {
            "question": question,
            "answer": summary,
            "raw_data": data,
            "tool_used": tool_key,
            "source": "rule_based",
            "latency_ms": round((time.time() - start_time) * 1000, 1),
        }

    def _summarize(self, tool: str, data: dict, question: str) -> str:
        """Generate human-readable summary from tool output."""
        if tool == "shap_explanation":
            factors = data.get("top_factors", [])
            lines = [f"**Decision {data.get('decision_id', 'N/A')} — Analysis:**\n"]
            for f in factors:
                lines.append(f"• **{f['feature']}** ({f['direction']}): {f['narrative']}")
            return "\n".join(lines)

        if tool == "graph_query":
            if isinstance(data, list):
                return f"Found {len(data)} graph connections. " + json.dumps(data[:3], indent=2)
            return json.dumps(data, indent=2)

        if tool == "system_health":
            return (
                f"**System Status: {data.get('status', 'unknown').upper()}**\n"
                f"• Uptime: {data.get('uptime_hours', 0):.1f}h\n"
                f"• P99 Latency: {data.get('api_latency_p99_ms', 0)}ms\n"
                f"• TPS: {data.get('transactions_per_second', 0):,}\n"
                f"• Active Alerts: {data.get('active_alerts', 0)}"
            )

        if tool == "decision_history":
            return (
                f"**User {data.get('user_id', 'N/A')} History:**\n"
                f"• Total decisions: {data.get('total_decisions', 0)}\n"
                f"• Fraud flags: {data.get('fraud_flags', 0)}\n"
                f"• Current credit score: {data.get('credit_score_current', 'N/A')}\n"
                f"• Trend: {data.get('credit_score_trend', 'N/A')}"
            )

        return json.dumps(data, indent=2)

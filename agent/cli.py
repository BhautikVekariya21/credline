"""
FinGuard 2026 — CLI Investigation Tool.

Terminal-based interface for system administrators to query system
health, investigate users, and interact with the Investigator Agent.
"""

from __future__ import annotations

import json
import sys
from typing import Any


BANNER = """
╔═══════════════════════════════════════════════════════════════╗
║           FinGuard 2026 — Investigator CLI                    ║
║       Autonomous Fraud Prevention & Credit Scoring            ║
╠═══════════════════════════════════════════════════════════════╣
║  Commands:                                                    ║
║    ask <question>     — Ask the AI investigator               ║
║    health             — System health check                   ║
║    user <user_id>     — Look up user history                  ║
║    graph <user_id>    — Show graph connections                ║
║    explain <dec_id>   — Explain a decision                    ║
║    drift              — Check model drift status              ║
║    retrain            — Trigger manual retraining             ║
║    serve              — Show model serving status             ║
║    help               — Show this help                        ║
║    exit               — Quit                                  ║
╚═══════════════════════════════════════════════════════════════╝
"""


def run_cli() -> None:
    """Main CLI entry point."""
    from agent.investigator import InvestigatorAgent

    print(BANNER)
    agent = InvestigatorAgent()

    while True:
        try:
            user_input = input("\n🔍 finguard> ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nGoodbye.")
            break

        if not user_input:
            continue

        parts = user_input.split(maxsplit=1)
        cmd = parts[0].lower()
        arg = parts[1] if len(parts) > 1 else ""

        if cmd in ("exit", "quit", "q"):
            print("Goodbye.")
            break

        elif cmd == "help":
            print(BANNER)

        elif cmd == "health":
            result = agent.tools["system_health"].run("system health status")
            _print_json(result)

        elif cmd == "user":
            result = agent.investigate(f"Show me the decision history for user {arg}")
            _print_result(result)

        elif cmd == "graph":
            result = agent.investigate(f"Show me the graph connections for user {arg}")
            _print_result(result)

        elif cmd == "explain":
            result = agent.investigate(f"Why was decision {arg} made? Show SHAP explanation.")
            _print_result(result)

        elif cmd == "drift":
            from mlops.retraining_dag import RetrainingOrchestrator

            orch = RetrainingOrchestrator()
            alerts = orch._get_drift_alerts()
            if alerts:
                print(f"⚠️  {len(alerts)} drift alerts detected:")
                for a in alerts:
                    print(f"   • {a.get('feature', 'unknown')}: {a.get('severity', 'unknown')}")
            else:
                print("✅ No drift detected. Models are stable.")

        elif cmd == "retrain":
            print("🔄 Triggering manual retraining...")
            from mlops.retraining_dag import RetrainingOrchestrator

            orch = RetrainingOrchestrator()
            result = orch.check_and_retrain()
            _print_json(json.dumps(result, indent=2, default=str))

        elif cmd == "serve":
            from mlops.model_server import ModelServer

            server = ModelServer()
            _print_json(json.dumps(server.get_serving_status(), indent=2))

        elif cmd == "ask":
            if not arg:
                print("Usage: ask <your question>")
                continue
            result = agent.investigate(arg)
            _print_result(result)

        else:
            # Treat entire input as a question
            result = agent.investigate(user_input)
            _print_result(result)


def _print_result(result: dict[str, Any]) -> None:
    print(f"\n{'─' * 60}")
    print(f"📋 Source: {result.get('source', 'unknown')} | "
          f"Tool: {result.get('tool_used', 'N/A')} | "
          f"Latency: {result.get('latency_ms', 0)}ms")
    print(f"{'─' * 60}")
    print(result.get("answer", "No answer generated."))


def _print_json(data: str) -> None:
    try:
        parsed = json.loads(data) if isinstance(data, str) else data
        print(json.dumps(parsed, indent=2))
    except (json.JSONDecodeError, TypeError):
        print(data)


if __name__ == "__main__":
    run_cli()

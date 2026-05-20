"""
FinGuard 2026 — SOAR Terminal / CLI Agent.

Deep investigation agent that performs forensic analysis via:
  1. Sandboxed CLI command execution (strict allowlist)
  2. Neo4j blast radius mapping of compromised entities
  3. IP intelligence via pre-approved diagnostic scripts
  4. Network diagnostic commands (ping, nslookup, tracert, whois)

Security: Only commands in ALLOWED_COMMANDS can execute. No arbitrary
shell execution is permitted. All output is logged to MongoDB.
"""

from __future__ import annotations

import json
import subprocess
import sys
import time
from typing import Any

from config.logging_config import get_logger
from soar.models import (
    BlastRadiusNode,
    CLICommandResult,
    FraudAlert,
    TerminalResult,
)

logger = get_logger(__name__)

# ─── Security: Command Allowlist ────────────────────────────────────────────

ALLOWED_COMMANDS: dict[str, dict[str, Any]] = {
    "ping": {
        "description": "ICMP ping to check host reachability",
        "template_win": ["ping", "-n", "3", "{target}"],
        "template_unix": ["ping", "-c", "3", "{target}"],
        "requires_target": True,
    },
    "nslookup": {
        "description": "DNS resolution lookup",
        "template_win": ["nslookup", "{target}"],
        "template_unix": ["nslookup", "{target}"],
        "requires_target": True,
    },
    "tracert": {
        "description": "Trace network route to host",
        "template_win": ["tracert", "-d", "-h", "15", "{target}"],
        "template_unix": ["traceroute", "-n", "-m", "15", "{target}"],
        "requires_target": True,
    },
    "whois": {
        "description": "WHOIS domain/IP registration lookup",
        "template_win": ["whois", "{target}"],
        "template_unix": ["whois", "{target}"],
        "requires_target": True,
    },
    "ip_forensics": {
        "description": "Run full IP forensics investigation script",
        "template_win": [sys.executable, "-m", "soar.scripts.ip_forensics", "{target}"],
        "template_unix": [sys.executable, "-m", "soar.scripts.ip_forensics", "{target}"],
        "requires_target": True,
    },
}

BLOCKED_PATTERNS = [
    "rm ", "del ", "format ", "shutdown", "reboot",
    "mkfs", "dd ", "> /dev/", "curl ", "wget ",
    "powershell", "cmd /c", "eval(", "exec(",
]

# ─── Prompt Template ────────────────────────────────────────────────────────

TERMINAL_SYSTEM_PROMPT = """You are a Security Engineer performing a deep-dive forensic 
investigation in the FinGuard 2026 platform.

You have access to these SAFE commands ONLY:
- ping: Check if a host is reachable
- nslookup: DNS resolution
- tracert: Trace network route
- whois: Domain/IP registration data
- ip_forensics: Full IP investigation (reverse DNS, GeoIP, threat intel)

You also have access to:
- Neo4j graph queries: Map the "blast radius" of compromised IPs/devices
- SHAP reason code analysis

RESTRICTED (NEVER execute):
- Any file deletion, modification, or system commands
- Any network requests (curl, wget)
- Any script not in the approved list

For each investigation step, explain WHY you are running the command
and what the results tell you about the fraud case."""


class TerminalAgent:
    """
    Terminal/CLI Agent — deep forensic investigation via secure CLI
    and graph database queries.
    """

    def __init__(self, neo4j_client: Any = None,
                 audit_store: Any = None) -> None:
        self._neo4j = neo4j_client
        self._audit = audit_store
        self._init_clients()

    def _init_clients(self) -> None:
        if self._neo4j is None:
            try:
                from database.neo4j_client import Neo4jClient
                self._neo4j = Neo4jClient()
            except Exception:
                pass

    def investigate(self, alert: FraudAlert,
                    investigation_id: str = "") -> TerminalResult:
        """
        Perform deep forensic investigation on a fraud alert.

        Steps:
        1. Run IP forensics on the suspicious IP
        2. Perform network diagnostics (ping, nslookup)
        3. Map blast radius in the graph database
        4. Compile findings
        """
        start = time.time()
        logger.info("terminal_investigation_started",
                    alert_id=alert.alert_id, ip=alert.ip_address)

        cli_results: list[CLICommandResult] = []
        suspicious_findings: list[str] = []

        # ── Step 1: IP Forensics ────────────────────────────────────
        ip_intel = {}
        ip_result = self._execute_command(
            "ip_forensics", alert.ip_address, investigation_id)
        if ip_result:
            cli_results.append(ip_result)
            try:
                ip_intel = json.loads(ip_result.stdout)
                risk = ip_intel.get("risk_assessment", {})
                if risk.get("overall_risk") in ("critical", "high"):
                    suspicious_findings.append(
                        f"IP {alert.ip_address}: {risk.get('overall_risk')} risk — "
                        f"{', '.join(risk.get('risk_factors', []))}")
            except json.JSONDecodeError:
                pass

        # ── Step 2: DNS Lookup ──────────────────────────────────────
        dns_result = self._execute_command(
            "nslookup", alert.ip_address, investigation_id)
        if dns_result:
            cli_results.append(dns_result)

        # ── Step 3: Blast Radius Mapping ────────────────────────────
        blast_radius, blast_summary = self._map_blast_radius(
            alert, investigation_id)
        graph_queries = 1 if blast_radius else 0

        if blast_radius:
            flagged = [n for n in blast_radius if n.is_flagged]
            if flagged:
                suspicious_findings.append(
                    f"Blast radius contains {len(flagged)} flagged entities")

            high_risk = [n for n in blast_radius if n.risk_score > 0.7]
            if high_risk:
                suspicious_findings.append(
                    f"{len(high_risk)} high-risk nodes within 3 hops")

        # ── Step 4: Network Diagnostics ─────────────────────────────
        net_diag = {}
        ping_result = self._execute_command(
            "ping", alert.ip_address, investigation_id)
        if ping_result:
            cli_results.append(ping_result)
            net_diag["ping_reachable"] = ping_result.exit_code == 0
            net_diag["ping_output"] = ping_result.stdout[:500]

        # ── Compile Results ─────────────────────────────────────────
        elapsed = (time.time() - start) * 1000
        reasoning = self._build_reasoning(
            alert, cli_results, blast_radius, ip_intel,
            suspicious_findings, elapsed)

        logger.info("terminal_investigation_complete",
                    alert_id=alert.alert_id,
                    commands_run=len(cli_results),
                    findings=len(suspicious_findings),
                    latency_ms=round(elapsed, 1))

        return TerminalResult(
            cli_commands_executed=cli_results,
            blast_radius=blast_radius,
            blast_radius_summary=blast_summary,
            ip_intelligence=ip_intel,
            network_diagnostics=net_diag,
            graph_queries_run=graph_queries,
            suspicious_findings=suspicious_findings,
            reasoning=reasoning,
        )

    # ─── Secure Command Execution ───────────────────────────────────────

    def _execute_command(
        self, command_name: str, target: str,
        investigation_id: str = "",
    ) -> CLICommandResult | None:
        """Execute a command from the allowlist only."""
        if command_name not in ALLOWED_COMMANDS:
            logger.warning("command_blocked", command=command_name,
                          reason="not_in_allowlist")
            return None

        # Validate target against blocked patterns
        for pattern in BLOCKED_PATTERNS:
            if pattern.lower() in target.lower():
                logger.warning("target_blocked", target=target,
                              pattern=pattern)
                return None

        spec = ALLOWED_COMMANDS[command_name]
        is_windows = sys.platform.startswith("win")
        template = spec["template_win"] if is_windows else spec["template_unix"]
        cmd = [arg.replace("{target}", target) for arg in template]

        logger.info("cli_executing", command=command_name,
                    target=target, cmd=" ".join(cmd))

        start = time.time()
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30,
                cwd=None,
            )
            elapsed_ms = (time.time() - start) * 1000

            cli_result = CLICommandResult(
                command=" ".join(cmd),
                exit_code=result.returncode,
                stdout=result.stdout[:2000],
                stderr=result.stderr[:500],
                duration_ms=round(elapsed_ms, 1),
            )

            # Log to audit store
            if self._audit:
                self._audit.log_action(
                    investigation_id=investigation_id,
                    agent="terminal",
                    action="execute_cli",
                    input_data={"command": command_name, "target": target},
                    output_data={"exit_code": result.returncode,
                                 "stdout_len": len(result.stdout)},
                )

            return cli_result

        except subprocess.TimeoutExpired:
            logger.warning("cli_timeout", command=command_name, target=target)
            return CLICommandResult(
                command=" ".join(cmd), exit_code=-1,
                stdout="", stderr="Command timed out after 30s",
                duration_ms=30000.0,
            )
        except FileNotFoundError:
            logger.warning("cli_not_found", command=command_name)
            return CLICommandResult(
                command=" ".join(cmd), exit_code=-1,
                stdout="", stderr=f"Command not found: {cmd[0]}",
            )
        except Exception as e:
            logger.error("cli_error", command=command_name, error=str(e))
            return None

    # ─── Blast Radius Mapping ───────────────────────────────────────────

    def _map_blast_radius(
        self, alert: FraudAlert, investigation_id: str = "",
    ) -> tuple[list[BlastRadiusNode], str]:
        """Map the blast radius of a compromised entity in Neo4j."""
        if self._neo4j is None:
            return [], "Neo4j unavailable — blast radius not mapped"

        try:
            neighborhood = self._neo4j.get_user_neighborhood(
                alert.user_id, depth=3)
            nodes_raw = neighborhood.get("nodes", [])

            blast_nodes = []
            for n in nodes_raw:
                blast_nodes.append(BlastRadiusNode(
                    node_id=n.get("id", "unknown"),
                    node_type=n.get("type", "Unknown"),
                    risk_score=float(n.get("risk", 0)),
                    distance=0,
                    is_flagged=bool(n.get("isFlagged", False)),
                ))

            if self._audit:
                self._audit.log_action(
                    investigation_id=investigation_id,
                    agent="terminal",
                    action="query_graph_blast_radius",
                    input_data={"user_id": alert.user_id, "depth": 3},
                    output_data={"nodes_found": len(blast_nodes)},
                )

            summary = (
                f"Blast radius: {len(blast_nodes)} entities within 3 hops. "
                f"Flagged: {sum(1 for n in blast_nodes if n.is_flagged)}. "
                f"High-risk: {sum(1 for n in blast_nodes if n.risk_score > 0.7)}."
            )
            return blast_nodes, summary

        except Exception as e:
            logger.warning("blast_radius_failed", error=str(e))
            return [], f"Blast radius mapping failed: {str(e)}"

    # ─── Reasoning Builder ──────────────────────────────────────────────

    def _build_reasoning(
        self, alert: FraudAlert,
        cli_results: list[CLICommandResult],
        blast_radius: list[BlastRadiusNode],
        ip_intel: dict, findings: list[str],
        elapsed_ms: float,
    ) -> str:
        lines = [
            f"## Terminal Investigation — {alert.alert_id}",
            f"**Duration:** {elapsed_ms:.0f}ms | "
            f"**Commands Run:** {len(cli_results)}",
            "",
            "### IP Intelligence:",
        ]
        risk = ip_intel.get("risk_assessment", {})
        if risk:
            lines.append(f"  Risk: {risk.get('overall_risk', 'unknown')}")
            for f in risk.get("risk_factors", []):
                lines.append(f"  - {f}")
        else:
            lines.append("  No IP intelligence available")

        lines.append("")
        lines.append(f"### Blast Radius: {len(blast_radius)} entities")
        flagged = [n for n in blast_radius if n.is_flagged]
        if flagged:
            lines.append(f"  ⚠ {len(flagged)} flagged entities found:")
            for n in flagged[:5]:
                lines.append(f"    - {n.node_type}:{n.node_id} "
                             f"(risk={n.risk_score:.2f})")

        if findings:
            lines.append("")
            lines.append(f"### Suspicious Findings ({len(findings)}):")
            for i, f in enumerate(findings, 1):
                lines.append(f"  {i}. {f}")

        return "\n".join(lines)

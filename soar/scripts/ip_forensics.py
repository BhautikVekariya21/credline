"""
FinGuard 2026 — SOAR IP Forensics Diagnostic Script.

Pre-approved script for the Terminal Agent. Performs network
intelligence gathering on suspicious IP addresses.

Usage: python -m soar.scripts.ip_forensics <ip_address>
"""

from __future__ import annotations
import json, socket, sys, time
from typing import Any


def reverse_dns(ip: str) -> dict[str, Any]:
    try:
        hostname, _, _ = socket.gethostbyaddr(ip)
        return {"ip": ip, "hostname": hostname, "resolved": True}
    except (socket.herror, socket.gaierror, OSError):
        return {"ip": ip, "hostname": None, "resolved": False}


def geoip_lookup(ip: str) -> dict[str, Any]:
    """Mock GeoIP. Production: MaxMind GeoIP2 or ipinfo.io."""
    prefixes = {
        "192.168.": {"country": "Private", "city": "LAN", "isp": "Private", "risk": "low"},
        "10.": {"country": "Private", "city": "LAN", "isp": "Private", "risk": "low"},
        "8.8.": {"country": "US", "city": "Mountain View", "isp": "Google", "risk": "low"},
    }
    for p, data in prefixes.items():
        if ip.startswith(p):
            return {"ip": ip, **data}
    return {"ip": ip, "country": "Unknown", "city": "Unknown", "isp": "Unknown", "risk": "elevated"}


def threat_intel_check(ip: str) -> dict[str, Any]:
    """Mock threat intel. Production: AbuseIPDB / VirusTotal."""
    bad = any(ip.startswith(p) for p in ["185.220.", "45.33.", "198.51."])
    return {
        "ip": ip, "is_malicious": bad,
        "threat_score": 0.92 if bad else 0.05,
        "categories": ["tor_exit_node", "botnet_c2"] if bad else [],
        "reports": 47 if bad else 0, "source": "mock_threat_intel",
    }


def full_investigation(ip: str) -> dict[str, Any]:
    start = time.time()
    rdns = reverse_dns(ip)
    geo = geoip_lookup(ip)
    threat = threat_intel_check(ip)
    risk_factors = []
    if threat["is_malicious"]:
        risk_factors.append(f"Flagged in threat intel (score={threat['threat_score']})")
    if geo["risk"] == "elevated":
        risk_factors.append("Unknown GeoIP location")
    if not rdns["resolved"]:
        risk_factors.append("No reverse DNS record")
    overall = "critical" if threat["is_malicious"] else (
        "high" if len(risk_factors) >= 2 else "medium" if risk_factors else "low")
    return {
        "target_ip": ip,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "reverse_dns": rdns, "geoip": geo, "threat_intel": threat,
        "risk_assessment": {"overall_risk": overall, "risk_factors": risk_factors,
                            "recommendation": "BLOCK" if threat["is_malicious"] else "MONITOR"},
        "duration_ms": round((time.time() - start) * 1000, 2),
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python -m soar.scripts.ip_forensics <ip>"}))
        sys.exit(1)
    print(json.dumps(full_investigation(sys.argv[1]), indent=2))

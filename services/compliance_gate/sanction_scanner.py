"""
Credit Line Fintech Solution — Phase 21: Real-Time Sanction & AML Screening Engine.

Provides fuzzy Jaro-Winkler string similarity scanning and GraphSAGE entity embedding
matching against global compliance watchlists (OFAC SDN, UN, EU list) under a strict 10ms SLA.
"""

from __future__ import annotations
import hashlib
import logging
import time
from typing import Dict, Any, List, Tuple, Optional

logger = logging.getLogger("SanctionScanner")

# Mock compliance watchlists with GraphSAGE embedding representations
WATCHLIST = [
    {"name": "Ivan Badov", "embedding": [0.12, 0.85, -0.22, 0.44], "watchlist": "OFAC SDN"},
    {"name": "Malicious Syndicate LLC", "embedding": [-0.48, 0.18, 0.79, -0.12], "watchlist": "EU Consolidated Sanctions"},
    {"name": "Alice Hacker", "embedding": [0.68, -0.08, 0.24, 0.58], "watchlist": "UN Terrorist List"},
    {"name": "Shadow Corp", "embedding": [0.31, 0.29, -0.33, -0.28], "watchlist": "OFAC SDN"},
    {"name": "Synergy Evil Corp", "embedding": [-0.15, 0.72, 0.45, -0.32], "watchlist": "UK Consolidated List"}
]

def jaro_winkler_similarity(s1: str, s2: str) -> float:
    """
    Computes Jaro-Winkler similarity between two strings.
    Returns value between 0.0 (no match) and 1.0 (exact match).
    """
    s1 = s1.strip().lower()
    s2 = s2.strip().lower()
    
    if s1 == s2:
        return 1.0
        
    len1, len2 = len(s1), len(s2)
    if len1 == 0 or len2 == 0:
        return 0.0
        
    # Maximum matching distance
    match_distance = max(len1, len2) // 2 - 1
    if match_distance < 0:
        match_distance = 0
        
    s1_matches = [False] * len1
    s2_matches = [False] * len2
    
    matches = 0
    transpositions = 0
    
    # 1. Count Jaro matches
    for i in range(len1):
        start = max(0, i - match_distance)
        end = min(len2, i + match_distance + 1)
        for j in range(start, end):
            if not s2_matches[j] and s1[i] == s2[j]:
                s1_matches[i] = True
                s2_matches[j] = True
                matches += 1
                break
                
    if matches == 0:
        return 0.0
        
    # 2. Count Jaro transpositions
    k = 0
    for i in range(len1):
        if s1_matches[i]:
            while not s2_matches[k]:
                k += 1
            if s1[i] != s2[k]:
                transpositions += 1
            k += 1
            
    t = transpositions // 2
    
    # Jaro Similarity
    jaro = (matches / len1 + matches / len2 + (matches - t) / matches) / 3.0
    
    # Winkler adjustment for common prefix (up to 4 chars)
    prefix_len = 0
    for i in range(min(4, min(len1, len2))):
        if s1[i] == s2[i]:
            prefix_len += 1
        else:
            break
            
    p = 0.1 # Standard scaling factor
    return jaro + prefix_len * p * (1.0 - jaro)


def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Computes the cosine similarity between two vector embeddings."""
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot_product = sum(x * y for x, y in zip(v1, v2))
    norm_v1 = sum(x * x for x in v1) ** 0.5
    norm_v2 = sum(x * x for x in v2) ** 0.5
    if norm_v1 == 0 or norm_v2 == 0:
        return 0.0
    return dot_product / (norm_v1 * norm_v2)


class SanctionScanner:
    """
    Main compliance matching engine.
    Scans entities against watchlists, maintaining a strict sub-10ms processing SLA.
    """

    @staticmethod
    def scan_entity(
        entity_name: str,
        entity_embedding: Optional[List[float]] = None,
        jaro_threshold: float = 0.85,
        vector_threshold: float = 0.90
    ) -> Dict[str, Any]:
        """
        Scan a single entity name and optional vector embedding.
        Returns quarantine status and match report details.
        """
        start_time = time.perf_counter()
        
        matches = []
        is_quarantined = False
        highest_score = 0.0
        primary_match_reason = None
        matched_watchlist = None

        for record in WATCHLIST:
            # 1. Evaluate Fuzzy Jaro-Winkler string match
            name_score = jaro_winkler_similarity(entity_name, record["name"])
            
            # 2. Evaluate GraphSAGE cosine similarity if vector is provided
            vector_score = 0.0
            if entity_embedding:
                vector_score = cosine_similarity(entity_embedding, record["embedding"])

            # Determine if match exceeds thresholds
            matched = False
            score = 0.0
            reason = None

            if name_score >= jaro_threshold:
                matched = True
                score = name_score
                reason = f"Fuzzy Jaro-Winkler match ({name_score:.3f} >= {jaro_threshold})"
            
            if vector_score >= vector_threshold:
                matched = True
                score = max(score, vector_score)
                reason = f"GraphSAGE vector match ({vector_score:.3f} >= {vector_threshold})" if not reason else reason + " & " + f"Vector match ({vector_score:.3f})"

            if matched:
                matches.append({
                    "matched_name": record["name"],
                    "watchlist": record["watchlist"],
                    "score": score,
                    "reason": reason
                })
                if score > highest_score:
                    highest_score = score
                    primary_match_reason = reason
                    matched_watchlist = record["watchlist"]
                is_quarantined = True

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        
        # Enforce sub-10ms SLA check
        sla_passed = elapsed_ms < 10.0

        if is_quarantined:
            logger.warning(
                f"compliance_sanction_match_quarantined: entity={entity_name}, watchlist={matched_watchlist}, score={highest_score:.3f}, latency_ms={elapsed_ms:.3f}"
            )

        return {
            "entity_name": entity_name,
            "is_quarantined": is_quarantined,
            "highest_similarity_score": highest_score,
            "primary_match_reason": primary_match_reason,
            "matched_watchlist": matched_watchlist,
            "matches": matches,
            "processing_latency_ms": elapsed_ms,
            "sla_passed": sla_passed,
            "audit_trail_hash": hashlib.sha256(
                f"{entity_name}:{is_quarantined}:{highest_score}:{elapsed_ms}".encode("utf-8")
            ).hexdigest()
        }

"""
Credit Line Fintech Solution — Phase 14: Contract Intelligence RAG Parser.

Document chunking, local vector indexing, semantic search, and transactional
ledger cross-referencing to audit vendor payment terms and SLA compliance.
"""

from __future__ import annotations

import re
from typing import Any


class LocalVectorIndex:
    """
    A lightweight, high-performance local vector index simulating ChromaDB.
    Uses TF-IDF term representation and cosine similarity for document retrieval.
    """
    def __init__(self):
        self.documents: list[str] = []
        self.chunk_ids: list[str] = []
        self.vocabulary: dict[str, int] = {}
        self.idf: dict[str, float] = {}
        self.vectors: list[np.ndarray] = []

    def fit_and_index(self, chunks: list[str], chunk_ids: list[str]):
        self.documents = chunks
        self.chunk_ids = chunk_ids

        # Build vocabulary
        vocab = set()
        doc_words = []
        for chunk in chunks:
            words = self._tokenize(chunk)
            doc_words.append(words)
            vocab.update(words)

        self.vocabulary = {word: idx for idx, word in enumerate(sorted(vocab))}
        num_docs = len(chunks)
        
        # Calculate TF and IDF
        doc_count_per_word = {word: 0 for word in self.vocabulary}
        for words in doc_words:
            unique_words = set(words)
            for w in unique_words:
                if w in doc_count_per_word:
                    doc_count_per_word[w] += 1

        self.idf = {}
        for word, count in doc_count_per_word.items():
            # Log-smooth IDF
            self.idf[word] = math.log((1 + num_docs) / (1 + count)) + 1.0

        # Calculate TF-IDF vectors
        import numpy as np
        self.vectors = []
        for words in doc_words:
            vec = np.zeros(len(self.vocabulary))
            for w in words:
                if w in self.vocabulary:
                    vec[self.vocabulary[w]] += 1
            # Multiply TF by IDF
            for w, idx in self.vocabulary.items():
                vec[idx] *= self.idf[w]
            
            # Normalize vector
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm
            self.vectors.append(vec)

    def similarity_search(self, query: str, k: int = 3) -> list[dict[str, Any]]:
        """Perform semantic search using cosine similarity."""
        import numpy as np
        query_words = self._tokenize(query)
        query_vec = np.zeros(len(self.vocabulary))
        for w in query_words:
            if w in self.vocabulary:
                query_vec[self.vocabulary[w]] += 1

        for w, idx in self.vocabulary.items():
            query_vec[idx] *= self.idf[w]

        q_norm = np.linalg.norm(query_vec)
        if q_norm > 0:
            query_vec = query_vec / q_norm

        scores = []
        for idx, doc_vec in enumerate(self.vectors):
            similarity = float(np.dot(query_vec, doc_vec))
            scores.append({
                "chunk_id": self.chunk_ids[idx],
                "content": self.documents[idx],
                "similarity": similarity
            })

        # Sort by similarity descending
        scores.sort(key=lambda x: x["similarity"], reverse=True)
        return scores[:k]

    def _tokenize(self, text: str) -> list[str]:
        words = re.findall(r'\b\w+\b', text.lower())
        # Filter short words / stop-words simulation
        return [w for w in words if len(w) > 2]


class DocumentChunker:
    """Chunks Master Service Agreements or leases into overlapping paragraphs."""
    @staticmethod
    def chunk_text(text: str, chunk_size: int = 150, overlap: int = 50) -> list[str]:
        paragraphs = text.split("\n\n")
        chunks = []
        current_chunk = []
        current_words = 0

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
            para_words = para.split()
            if current_words + len(para_words) <= chunk_size:
                current_chunk.append(para)
                current_words += len(para_words)
            else:
                if current_chunk:
                    chunks.append("\n\n".join(current_chunk))
                # Rollback overlap logic
                current_chunk = current_chunk[-1:] if len(current_chunk) > 1 else []
                current_chunk.append(para)
                current_words = sum(len(p.split()) for p in current_chunk)

        if current_chunk:
            chunks.append("\n\n".join(current_chunk))
        return chunks


class ContractRAGParser:
    """Vector index orchestrator that parses contracts and audits ledger compliance."""
    def __init__(self):
        self.index = LocalVectorIndex()

    def ingest_contract(self, filename: str, content: str):
        """Ingests MSA or Lease content, chunks it, and indexes it into the vector space."""
        chunks = DocumentChunker.chunk_text(content)
        chunk_ids = [f"{filename}#chunk-{i}" for i in range(len(chunks))]
        self.index.fit_and_index(chunks, chunk_ids)

    def extract_term(self, keyword_query: str) -> dict[str, Any]:
        """Search contract clauses for a specific term (e.g. Payment window)."""
        results = self.index.similarity_search(keyword_query, k=2)
        if not results:
            return {"term": "UNKNOWN", "clause": "No matching clause found."}

        # Look for Net-X payment term patterns inside matching clauses
        clause_text = results[0]["content"]
        match = re.search(r'(net[- ]\d+|payment within \d+ days|payable within \d+ days)', clause_text, re.IGNORECASE)
        
        extracted_days = 30 # Default fallback
        if match:
            days_match = re.search(r'\d+', match.group(1))
            if days_match:
                extracted_days = int(days_match.group(0))

        return {
            "clause": clause_text,
            "detected_payment_terms": f"Net-{extracted_days}",
            "days": extracted_days,
            "match_confidence": results[0]["similarity"]
        }

    def audit_ledger_transactions(
        self,
        ledger_entries: list[dict[str, Any]],
        vendor_name: str,
        payment_term_days: int
    ) -> list[dict[str, Any]]:
        """
        Cross-references ledger entries against contract parameters.
        Flags late payment penalties or payment timing violations (e.g. paid after Net-X deadline).
        """
        violations = []
        
        # Track invoice creation dates vs corresponding bank payment dates
        # Simulates mapping debits/credits in standard accounting journal
        invoices: dict[str, dict[str, Any]] = {}
        payments: list[dict[str, Any]] = []

        for tx in ledger_entries:
            desc = str(tx.get("description", "")).lower()
            vendor = str(tx.get("vendor", "")).lower()
            if vendor_name.lower() not in vendor and vendor_name.lower() not in desc:
                continue

            ref = tx.get("reference", tx.get("transaction_id", ""))
            amount = float(tx.get("amount", 0.0))
            tx_date_str = tx.get("timestamp", tx.get("date", ""))
            
            # Simple date parsing
            try:
                tx_date = datetime.fromisoformat(tx_date_str.replace("Z", "+00:00"))
            except Exception:
                tx_date = datetime.now()

            is_invoice = tx.get("transaction_type", "") == "DEBIT" or "invoice" in desc or "billed" in desc
            is_payment = tx.get("transaction_type", "") == "CREDIT" or "paid" in desc or "payment" in desc or "cleared" in desc

            if is_invoice:
                invoices[ref] = {
                    "date": tx_date,
                    "amount": amount,
                    "reference": ref
                }
            elif is_payment:
                payments.append({
                    "date": tx_date,
                    "amount": amount,
                    "reference": ref
                })

        # Match payments to invoices (FIFO or amount-based matching)
        for ref, inv in invoices.items():
            inv_date = inv["date"]
            # Find closest payment date after the invoice date
            matching_payment = None
            min_diff = float('inf')

            for pay in payments:
                if pay["date"] >= inv_date:
                    diff = (pay["date"] - inv_date).days
                    if diff < min_diff:
                        min_diff = diff
                        matching_payment = pay

            if matching_payment:
                days_taken = (matching_payment["date"] - inv_date).days
                if days_taken > payment_term_days:
                    violations.append({
                        "invoice_ref": ref,
                        "invoice_date": inv_date.date().isoformat(),
                        "payment_ref": matching_payment["reference"],
                        "payment_date": matching_payment["date"].date().isoformat(),
                        "days_to_pay": days_taken,
                        "allowed_days": payment_term_days,
                        "excess_days": days_taken - payment_term_days,
                        "status": "LATE_PAYMENT_VIOLATION",
                        "severity": "CRITICAL" if days_taken > payment_term_days + 15 else "WARNING"
                    })
            else:
                # Outstanding invoice: check if it is already overdue
                days_pending = (datetime.now(inv_date.tzinfo) - inv_date).days
                if days_pending > payment_term_days:
                    violations.append({
                        "invoice_ref": ref,
                        "invoice_date": inv_date.date().isoformat(),
                        "payment_ref": "UNPAID",
                        "payment_date": "N/A",
                        "days_to_pay": days_pending,
                        "allowed_days": payment_term_days,
                        "excess_days": days_pending - payment_term_days,
                        "status": "OVERDUE_UNPAID_INVOICE",
                        "severity": "CRITICAL" if days_pending > payment_term_days + 10 else "WARNING"
                    })

        return violations


# Mock standard dependencies needed inside module scope
import math
from datetime import datetime
import numpy as np

# Sample mock MSA document text for default loading
MOCK_MSA_CONTRACT = """
MASTER SERVICE AGREEMENT

This Master Service Agreement ("Agreement") is entered into by and between Credit Line Solutions (the "Company") and AWS Cloud Services India ("Supplier").

1. SERVICES AND FEES
Supplier shall provide cloud container infrastructure hosting, computing, and database services as configured in Service Schedules. Rates are billed monthly according to the AWS On-Demand fee index. Under no circumstances shall AWS Cloud compute limits exceed a monthly cap of INR 50,00,000 without written authorization.

2. PAYMENT TERMS
Invoices will be generated by the Supplier on the first calendar day of each month following service delivery. All payments under this Agreement must be settled in full. Payment terms are strictly Net-30 payment required from the date of invoice. Late payments shall accrue interest at a rate of 1.5% per month.

3. SLA AND SERVICE SUSPENSION
AWS commits to a monthly uptime SLA of 99.99%. If uptime falls below 99.9%, Company shall receive a 10% billing credit.
"""

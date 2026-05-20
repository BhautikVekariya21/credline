"""
GST portal/GSP submission client.

Real GST return filing requires GSTN/GSP access, taxpayer authorization, and
return signing. This client deliberately does not fabricate acknowledgement
numbers: it submits to a configured GSP endpoint or raises a configuration error.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from config.settings import get_settings


class GSTPortalConfigurationError(RuntimeError):
    """Raised when real GST portal filing is requested without GSP configuration."""


class GSTPortalSubmissionError(RuntimeError):
    """Raised when the configured GSP rejects or fails a GST filing submission."""


@dataclass(frozen=True)
class GSTPortalSubmission:
    gstin: str
    period: str
    gstr1_payload: dict[str, Any]
    gstr3b_payload: dict[str, Any]
    summary: dict[str, Any]


class GSTPortalClient:
    """Submit GST returns through a configured GSTN/GSP API gateway."""

    def __init__(self) -> None:
        self._settings = get_settings().gst_portal

    @property
    def is_configured(self) -> bool:
        return self._settings.enabled and bool(
            self._settings.base_url
            and self._settings.submit_return_path
            and self._settings.auth_token
        )

    async def submit_return(self, submission: GSTPortalSubmission) -> dict[str, Any]:
        if not self.is_configured:
            raise GSTPortalConfigurationError(
                "Real GST filing is not configured. Set GST_PORTAL_ENABLED=true, "
                "GST_PORTAL_BASE_URL, GST_PORTAL_SUBMIT_RETURN_PATH, and "
                "GST_PORTAL_AUTH_TOKEN for your authorized GSP/GSTN gateway."
            )

        url = self._build_url(self._settings.submit_return_path)
        payload = {
            "gstin": submission.gstin,
            "period": submission.period,
            "return_type": self._settings.return_type,
            "gstr1": submission.gstr1_payload,
            "gstr3b": submission.gstr3b_payload,
            "summary": submission.summary,
        }

        headers = {
            "Authorization": f"Bearer {self._settings.auth_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if self._settings.client_id:
            headers["x-client-id"] = self._settings.client_id
        if self._settings.client_secret:
            headers["x-client-secret"] = self._settings.client_secret
        if self._settings.taxpayer_username:
            headers["x-gst-username"] = self._settings.taxpayer_username

        try:
            async with httpx.AsyncClient(timeout=self._settings.timeout_seconds) as client:
                response = await client.post(url, json=payload, headers=headers)
        except httpx.HTTPError as exc:
            raise GSTPortalSubmissionError(f"GST portal submission failed: {exc}") from exc

        if response.status_code >= 400:
            raise GSTPortalSubmissionError(
                f"GST portal rejected filing with {response.status_code}: {response.text[:500]}"
            )

        try:
            portal_response = response.json()
        except ValueError as exc:
            raise GSTPortalSubmissionError("GST portal returned a non-JSON response.") from exc

        return {
            "filing_status": self._extract_status(portal_response),
            "acknowledgement_ref": self._extract_acknowledgement(portal_response),
            "portal_response": portal_response,
        }

    def _build_url(self, path: str) -> str:
        base = self._settings.base_url.rstrip("/")
        clean_path = path if path.startswith("/") else f"/{path}"
        return f"{base}{clean_path}"

    @staticmethod
    def _extract_status(response: dict[str, Any]) -> str:
        for key in ("filing_status", "status", "retstatus", "message"):
            value = response.get(key)
            if value:
                return str(value)
        return "SUBMITTED_TO_GST_PORTAL"

    @staticmethod
    def _extract_acknowledgement(response: dict[str, Any]) -> str | None:
        for key in ("acknowledgement_ref", "ack_no", "ackNo", "arn", "reference_id", "ref_id"):
            value = response.get(key)
            if value:
                return str(value)
        return None

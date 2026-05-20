"""
FinGuard 2026 — Human-Readable Reason Code Templates.

Maps feature importances to regulatory-compliant denial/approval explanations.
Compliant with ECOA adverse action notice requirements.
"""

from __future__ import annotations

# ─── Reason Code Templates ─────────────────────────────────────────────────
# Each template maps a feature name to positive and negative explanations.

REASON_TEMPLATES: dict[str, dict[str, str]] = {
    # Telco features
    "topup_regularity_score": {
        "positive": "Strong {months}-month prepaid top-up consistency (score: {value:.2f})",
        "negative": "Irregular prepaid top-up pattern over {months} months (score: {value:.2f})",
    },
    "sim_tenure_months": {
        "positive": "Long-standing mobile account ({value:.0f} months)",
        "negative": "Short mobile account history ({value:.0f} months)",
    },
    "data_usage_consistency": {
        "positive": "Consistent mobile data usage pattern (consistency: {value:.2f})",
        "negative": "Volatile mobile data usage pattern (consistency: {value:.2f})",
    },
    "avg_monthly_topup": {
        "positive": "Healthy average monthly top-up amount (${value:.2f})",
        "negative": "Low average monthly top-up amount (${value:.2f})",
    },
    # Utility features
    "on_time_rate": {
        "positive": "Strong utility payment punctuality ({value:.0%} on-time)",
        "negative": "History of late utility payments ({value:.0%} on-time)",
    },
    "payment_consistency_index": {
        "positive": "Consistent utility payment amounts (index: {value:.2f})",
        "negative": "Volatile utility payment amounts (index: {value:.2f})",
    },
    "missed_payments_12m": {
        "positive": "No missed utility payments in 12 months",
        "negative": "Missed {value:.0f} utility payment(s) in past 12 months",
    },
    "payment_day_consistency": {
        "positive": "Payments consistently made on the same day each month",
        "negative": "Inconsistent payment dates across months (score: {value:.2f})",
    },
    "late_payments_12m": {
        "positive": "No late payments in 12 months",
        "negative": "{value:.0f} late payment(s) in past 12 months",
    },
    # Transaction features
    "tx_count_1h": {
        "positive": "Normal transaction frequency",
        "negative": "Unusual transaction velocity: {value:.0f} transactions in 1 hour",
    },
    "amount_zscore": {
        "positive": "Transaction amount within normal range",
        "negative": "Unusual transaction amount (z-score: {value:.2f})",
    },
    "geo_velocity_kmh": {
        "positive": "Normal geographic movement pattern",
        "negative": "Impossible travel detected ({value:.0f} km/h between transactions)",
    },
    "device_user_count": {
        "positive": "Device used by single account holder",
        "negative": "Device shared across {value:.0f} accounts (risk indicator)",
    },
    # E-commerce features
    "ecommerce_return_rate": {
        "positive": "Low e-commerce return rate ({value:.0%})",
        "negative": "High e-commerce return rate ({value:.0%})",
    },
    "order_frequency_30d": {
        "positive": "Regular purchasing activity ({value:.0f} orders/30d)",
        "negative": "Limited purchasing history ({value:.0f} orders/30d)",
    },
}

# ─── Default template for unknown features ──────────────────────────────────
DEFAULT_TEMPLATE = {
    "positive": "Favorable signal from {feature_name} (value: {value:.4f})",
    "negative": "Unfavorable signal from {feature_name} (value: {value:.4f})",
}


def generate_reason_text(feature_name: str, shap_value: float,
                         feature_value: float, months: int = 6) -> str:
    """
    Generate a human-readable reason text for a feature.

    Args:
        feature_name: Name of the feature.
        shap_value: SHAP value (positive = pushes toward approval/safe).
        feature_value: Actual feature value.
        months: Lookback period for template context.

    Returns:
        Human-readable explanation string.
    """
    template_dict = REASON_TEMPLATES.get(feature_name, DEFAULT_TEMPLATE)

    direction = "positive" if shap_value > 0 else "negative"
    template = template_dict[direction]

    try:
        return template.format(
            value=feature_value,
            months=months,
            feature_name=feature_name.replace("_", " ").title(),
        )
    except (KeyError, ValueError):
        return f"{'Positive' if shap_value > 0 else 'Negative'} signal: {feature_name} = {feature_value}"

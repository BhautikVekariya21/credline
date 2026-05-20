"""
FinGuard 2026 — Synthetic Data Generator.

Generates realistic synthetic datasets for all FinGuard data schemas.
Used for development, testing, and model prototyping without real financial data.

Usage:
    python -m data.synthetic.generate_synthetic --n_transactions 10000 --fraud_rate 0.02
"""

from __future__ import annotations

import argparse
import json
import math
import random
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from data.schemas.biometric import BiometricSample
from data.schemas.telco import TelcoProfile, TopUpRecord
from data.schemas.transaction import (
    GeoLocation,
    MerchantCategory,
    TransactionEvent,
)
from data.schemas.utility import (
    PaymentStatus,
    UtilityPayment,
    UtilityProfile,
    UtilityType,
)


# ─── Constants ──────────────────────────────────────────────────────────────────

CITIES = [
    ("New York", 40.7128, -74.0060, "US"),
    ("London", 51.5074, -0.1278, "GB"),
    ("Lagos", 6.5244, 3.3792, "NG"),
    ("Nairobi", -1.2921, 36.8219, "KE"),
    ("Mumbai", 19.0760, 72.8777, "IN"),
    ("São Paulo", -23.5505, -46.6333, "BR"),
    ("Jakarta", -6.2088, 106.8456, "ID"),
    ("Manila", 14.5995, 120.9842, "PH"),
    ("Dhaka", 23.8103, 90.4125, "BD"),
    ("Mexico City", 19.4326, -99.1332, "MX"),
]

CARRIERS = ["MTN", "Airtel", "Vodafone", "Safaricom", "Globe", "Jio", "T-Mobile"]
UTILITY_PROVIDERS = ["CityPower", "AquaServe", "MetroGas", "NetConnect", "UrbanHousing"]


class SyntheticDataGenerator:
    """
    Generates coherent synthetic financial data with realistic patterns.

    Features:
    - Configurable fraud rate and unbanked population ratio
    - Realistic transaction graphs with shared merchants/devices
    - Correlated biometric signals (genuine vs. fraudulent sessions)
    - Thin-file profiles with varying credit quality
    """

    def __init__(
        self,
        n_users: int = 1000,
        n_merchants: int = 200,
        n_devices: int = 800,
        fraud_rate: float = 0.02,
        unbanked_ratio: float = 0.30,
        seed: int = 42,
    ):
        self.n_users = n_users
        self.n_merchants = n_merchants
        self.n_devices = n_devices
        self.fraud_rate = fraud_rate
        self.unbanked_ratio = unbanked_ratio
        self.rng = np.random.default_rng(seed)
        random.seed(seed)

        # Generate entity pools
        self.user_ids = [f"USR-{uuid.uuid4().hex[:8]}" for _ in range(n_users)]
        self.merchant_ids = [f"MRC-{uuid.uuid4().hex[:8]}" for _ in range(n_merchants)]
        self.device_ids = [f"DEV-{uuid.uuid4().hex[:8]}" for _ in range(n_devices)]
        self.ip_pool = [f"hash_{uuid.uuid4().hex[:12]}" for _ in range(n_devices * 2)]

        # Assign primary devices to users (some users share devices → fraud signal)
        self.user_device_map: dict[str, str] = {}
        for uid in self.user_ids:
            self.user_device_map[uid] = random.choice(self.device_ids)

        # Mark some users as "fraudulent"
        n_fraud_users = max(1, int(n_users * fraud_rate * 5))  # pool of potential fraudsters
        self.fraud_users = set(random.sample(self.user_ids, n_fraud_users))

        # Mark unbanked users
        n_unbanked = int(n_users * unbanked_ratio)
        self.unbanked_users = set(random.sample(self.user_ids, n_unbanked))

    def generate_transaction(
        self, user_id: str | None = None, timestamp: datetime | None = None
    ) -> TransactionEvent:
        """Generate a single synthetic transaction event."""
        uid = user_id or random.choice(self.user_ids)
        is_fraud = uid in self.fraud_users and random.random() < 0.3

        ts = timestamp or datetime.utcnow() - timedelta(
            days=random.randint(0, 180),
            hours=random.randint(0, 23),
            minutes=random.randint(0, 59),
        )

        city = random.choice(CITIES)

        # Fraud transactions tend to be higher amounts, unusual hours
        if is_fraud:
            amount = self.rng.lognormal(mean=6.0, sigma=1.5)
            channel = random.choice(["online", "mobile"])
            device = random.choice(self.device_ids)  # random device
        else:
            amount = self.rng.lognormal(mean=3.5, sigma=1.0)
            channel = random.choice(["online", "pos", "atm", "mobile"])
            device = self.user_device_map.get(uid, random.choice(self.device_ids))

        return TransactionEvent(
            transaction_id=f"TXN-{uuid.uuid4().hex[:12]}",
            user_id=uid,
            merchant_id=random.choice(self.merchant_ids),
            amount=round(float(amount), 2),
            currency="USD",
            timestamp=ts,
            device_id=device,
            ip_address=random.choice(self.ip_pool),
            location=GeoLocation(
                latitude=city[1] + self.rng.normal(0, 0.01),
                longitude=city[2] + self.rng.normal(0, 0.01),
                country_code=city[3],
                city=city[0],
            ),
            channel=channel,
            merchant_category=random.choice(list(MerchantCategory)),
            is_fraud=is_fraud,
            fraud_type="synthetic_pattern" if is_fraud else None,
        ).enrich()

    def generate_transactions(self, n: int = 10000) -> list[TransactionEvent]:
        """Generate a batch of synthetic transactions."""
        return [self.generate_transaction() for _ in range(n)]

    def generate_biometric_sample(
        self, user_id: str | None = None, is_genuine: bool = True
    ) -> BiometricSample:
        """Generate a synthetic biometric sample."""
        uid = user_id or random.choice(self.user_ids)
        n_timesteps = random.randint(50, 200)

        if is_genuine:
            # Consistent patterns: stable device angle, regular typing
            base_angle = self.rng.uniform(20, 40)  # typical phone hold angle
            gyro = [
                [
                    float(self.rng.normal(base_angle, 2.0)),
                    float(self.rng.normal(0, 1.0)),
                    float(self.rng.normal(0, 1.0)),
                ]
                for _ in range(n_timesteps)
            ]
            accel = [
                [
                    float(self.rng.normal(0, 0.5)),
                    float(self.rng.normal(9.8, 0.3)),  # gravity
                    float(self.rng.normal(0, 0.5)),
                ]
                for _ in range(n_timesteps)
            ]
            keystroke = [float(self.rng.normal(120, 20)) for _ in range(30)]
        else:
            # Bot-like: erratic angles, mechanical typing
            gyro = [
                [
                    float(self.rng.uniform(-180, 180)),
                    float(self.rng.uniform(-180, 180)),
                    float(self.rng.uniform(-180, 180)),
                ]
                for _ in range(n_timesteps)
            ]
            accel = [
                [
                    float(self.rng.normal(0, 5.0)),
                    float(self.rng.normal(9.8, 3.0)),
                    float(self.rng.normal(0, 5.0)),
                ]
                for _ in range(n_timesteps)
            ]
            keystroke = [float(self.rng.normal(50, 5)) for _ in range(30)]

        return BiometricSample(
            session_id=f"SES-{uuid.uuid4().hex[:8]}",
            user_id=uid,
            timestamp=datetime.utcnow(),
            gyroscope=gyro,
            accelerometer=accel,
            keystroke_intervals=keystroke,
            key_hold_durations=[float(self.rng.normal(80, 15)) for _ in range(30)],
            screen_touch_pressure=[float(self.rng.uniform(0.2, 0.8)) for _ in range(20)],
            screen_touch_area=[float(self.rng.uniform(0.1, 0.5)) for _ in range(20)],
            screen_transitions=random.randint(1, 5) if is_genuine else random.randint(15, 50),
            session_duration_ms=float(self.rng.uniform(5000, 60000)),
            is_genuine=is_genuine,
        )

    def generate_telco_profile(self, user_id: str | None = None) -> TelcoProfile:
        """Generate a synthetic telco profile for thin-file scoring."""
        uid = user_id or random.choice(list(self.unbanked_users))
        is_good_credit = random.random() > 0.3

        sim_tenure = random.randint(6, 60) if is_good_credit else random.randint(1, 12)
        reg_date = date.today() - timedelta(days=sim_tenure * 30)

        # Generate top-up history
        topups = []
        base_day = random.randint(1, 28)
        base_amount = self.rng.uniform(10, 100)
        for month_offset in range(6):
            d = date.today() - timedelta(days=(6 - month_offset) * 30)
            if is_good_credit:
                day = base_day + random.randint(-2, 2)
                amount = base_amount * self.rng.uniform(0.85, 1.15)
            else:
                day = random.randint(1, 28)
                amount = self.rng.uniform(5, 200)
                if random.random() < 0.3:
                    continue  # skip month
            topups.append(
                TopUpRecord(
                    date=d.replace(day=max(1, min(28, day))),
                    amount=round(float(amount), 2),
                    channel=random.choice(["mobile_money", "agent", "bank"]),
                )
            )

        amounts = [t.amount for t in topups]
        avg_topup = float(np.mean(amounts)) if amounts else 0.0
        regularity = 1.0 - min(1.0, float(np.std(amounts)) / max(avg_topup, 1.0)) if amounts else 0.0

        return TelcoProfile(
            user_id=uid,
            phone_hash=f"ph_{uuid.uuid4().hex[:10]}",
            carrier=random.choice(CARRIERS),
            sim_registration_date=reg_date,
            sim_tenure_months=sim_tenure,
            is_primary_sim=random.random() > 0.1,
            topup_history=topups,
            avg_monthly_topup=round(avg_topup, 2),
            topup_regularity_score=round(float(regularity), 3),
            preferred_topup_day=base_day if is_good_credit else None,
            avg_daily_calls_min=round(float(self.rng.uniform(5, 120)), 1),
            avg_daily_data_mb=round(float(self.rng.uniform(50, 2000)), 1),
            data_usage_consistency=round(float(self.rng.uniform(0.3, 0.95)), 3),
            sms_per_day=round(float(self.rng.uniform(1, 50)), 1),
            unique_contacts_30d=random.randint(5, 200),
            international_calls_pct=round(float(self.rng.uniform(0, 0.15)), 3),
        )

    def generate_utility_profile(
        self, user_id: str | None = None
    ) -> UtilityProfile:
        """Generate a synthetic utility payment profile."""
        uid = user_id or random.choice(list(self.unbanked_users))
        is_good_payer = random.random() > 0.25
        utility_type = random.choice(list(UtilityType))

        tenure = random.randint(6, 48)
        start_date = date.today() - timedelta(days=tenure * 30)

        # Generate 12 months of payment history
        payments = []
        base_amount = self.rng.uniform(30, 200)
        base_pay_day = random.randint(1, 28)

        for month_offset in range(12):
            billing = date.today() - timedelta(days=(12 - month_offset) * 30)
            due = billing + timedelta(days=15)
            amount_due = round(float(base_amount * self.rng.uniform(0.8, 1.2)), 2)

            if is_good_payer:
                if random.random() < 0.85:
                    status = PaymentStatus.PAID_ON_TIME
                    pay_day = base_pay_day + random.randint(-1, 1)
                    pay_date = due - timedelta(days=random.randint(0, 3))
                    days_late = 0
                else:
                    status = PaymentStatus.PAID_LATE
                    pay_date = due + timedelta(days=random.randint(1, 10))
                    days_late = (pay_date - due).days
                amount_paid = amount_due
            else:
                roll = random.random()
                if roll < 0.4:
                    status = PaymentStatus.PAID_ON_TIME
                    pay_date = due - timedelta(days=random.randint(0, 2))
                    days_late = 0
                    amount_paid = amount_due
                elif roll < 0.7:
                    status = PaymentStatus.PAID_LATE
                    pay_date = due + timedelta(days=random.randint(5, 30))
                    days_late = (pay_date - due).days
                    amount_paid = amount_due
                elif roll < 0.85:
                    status = PaymentStatus.PARTIAL
                    pay_date = due + timedelta(days=random.randint(0, 15))
                    days_late = max(0, (pay_date - due).days)
                    amount_paid = round(amount_due * self.rng.uniform(0.3, 0.8), 2)
                else:
                    status = PaymentStatus.MISSED
                    pay_date = None
                    days_late = 0
                    amount_paid = 0.0

            payments.append(
                UtilityPayment(
                    billing_period=billing.strftime("%Y-%m"),
                    due_date=due,
                    payment_date=pay_date,
                    amount_due=amount_due,
                    amount_paid=amount_paid,
                    status=status,
                    days_late=days_late,
                )
            )

        profile = UtilityProfile(
            user_id=uid,
            utility_type=utility_type,
            provider=random.choice(UTILITY_PROVIDERS),
            account_number_hash=f"acc_{uuid.uuid4().hex[:10]}",
            account_start_date=start_date,
            account_tenure_months=tenure,
            payment_history=payments,
        )
        profile.compute_consistency_metrics()
        return profile

    def generate_full_dataset(
        self,
        n_transactions: int = 10000,
        n_biometric: int = 2000,
        n_telco: int = 300,
        n_utility: int = 300,
        output_dir: str = "./data/synthetic/output",
    ) -> dict[str, Any]:
        """Generate and save complete synthetic dataset."""
        out = Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)

        print(f"Generating {n_transactions} transactions...")
        transactions = self.generate_transactions(n_transactions)
        tx_data = [t.model_dump(mode="json") for t in transactions]
        with open(out / "transactions.json", "w") as f:
            json.dump(tx_data, f, indent=2, default=str)

        # Also save as CSV for tabular workflows
        tx_df = pd.DataFrame(
            [
                {
                    "transaction_id": t.transaction_id,
                    "user_id": t.user_id,
                    "merchant_id": t.merchant_id,
                    "amount": t.amount,
                    "timestamp": t.timestamp.isoformat(),
                    "device_id": t.device_id,
                    "ip_address": t.ip_address,
                    "channel": t.channel,
                    "merchant_category": t.merchant_category.value,
                    "latitude": t.location.latitude,
                    "longitude": t.location.longitude,
                    "country_code": t.location.country_code,
                    "is_fraud": t.is_fraud,
                    "hour_of_day": t.hour_of_day,
                    "day_of_week": t.day_of_week,
                    "is_weekend": t.is_weekend,
                    "amount_log": t.amount_log,
                }
                for t in transactions
            ]
        )
        tx_df.to_csv(out / "transactions.csv", index=False)

        print(f"Generating {n_biometric} biometric samples...")
        bio_genuine = [
            self.generate_biometric_sample(is_genuine=True)
            for _ in range(int(n_biometric * 0.8))
        ]
        bio_fraud = [
            self.generate_biometric_sample(is_genuine=False)
            for _ in range(int(n_biometric * 0.2))
        ]
        bio_all = bio_genuine + bio_fraud
        random.shuffle(bio_all)
        with open(out / "biometrics.json", "w") as f:
            json.dump([b.model_dump(mode="json") for b in bio_all], f, indent=2, default=str)

        print(f"Generating {n_telco} telco profiles...")
        unbanked = list(self.unbanked_users)
        telco_profiles = [
            self.generate_telco_profile(uid) for uid in unbanked[:n_telco]
        ]
        with open(out / "telco_profiles.json", "w") as f:
            json.dump(
                [t.model_dump(mode="json") for t in telco_profiles], f, indent=2, default=str
            )

        print(f"Generating {n_utility} utility profiles...")
        utility_profiles = [
            self.generate_utility_profile(uid) for uid in unbanked[:n_utility]
        ]
        with open(out / "utility_profiles.json", "w") as f:
            json.dump(
                [u.model_dump(mode="json") for u in utility_profiles], f, indent=2, default=str
            )

        # Build edge list for graph construction
        print("Building transaction graph edge list...")
        edges = {
            "user_merchant": [],
            "user_device": [],
            "user_ip": [],
        }
        for t in transactions:
            edges["user_merchant"].append((t.user_id, t.merchant_id))
            edges["user_device"].append((t.user_id, t.device_id))
            edges["user_ip"].append((t.user_id, t.ip_address))

        with open(out / "graph_edges.json", "w") as f:
            json.dump(edges, f, indent=2)

        stats = {
            "n_transactions": len(transactions),
            "n_fraud": sum(1 for t in transactions if t.is_fraud),
            "fraud_rate": sum(1 for t in transactions if t.is_fraud) / len(transactions),
            "n_users": self.n_users,
            "n_merchants": self.n_merchants,
            "n_biometric_samples": len(bio_all),
            "n_telco_profiles": len(telco_profiles),
            "n_utility_profiles": len(utility_profiles),
            "n_unbanked_users": len(self.unbanked_users),
            "n_graph_edges": sum(len(v) for v in edges.values()),
        }

        with open(out / "dataset_stats.json", "w") as f:
            json.dump(stats, f, indent=2)

        print(f"\n✅ Dataset generated at {out}")
        print(f"   Transactions: {stats['n_transactions']} (fraud: {stats['n_fraud']}, "
              f"rate: {stats['fraud_rate']:.2%})")
        print(f"   Biometric samples: {stats['n_biometric_samples']}")
        print(f"   Telco profiles: {stats['n_telco_profiles']}")
        print(f"   Utility profiles: {stats['n_utility_profiles']}")
        print(f"   Graph edges: {stats['n_graph_edges']}")

        return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="FinGuard Synthetic Data Generator")
    parser.add_argument("--n_transactions", type=int, default=10000)
    parser.add_argument("--n_biometric", type=int, default=2000)
    parser.add_argument("--n_telco", type=int, default=300)
    parser.add_argument("--n_utility", type=int, default=300)
    parser.add_argument("--n_users", type=int, default=1000)
    parser.add_argument("--n_merchants", type=int, default=200)
    parser.add_argument("--fraud_rate", type=float, default=0.02)
    parser.add_argument("--unbanked_ratio", type=float, default=0.30)
    parser.add_argument("--output_dir", type=str, default="./data/synthetic/output")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    gen = SyntheticDataGenerator(
        n_users=args.n_users,
        n_merchants=args.n_merchants,
        fraud_rate=args.fraud_rate,
        unbanked_ratio=args.unbanked_ratio,
        seed=args.seed,
    )
    gen.generate_full_dataset(
        n_transactions=args.n_transactions,
        n_biometric=args.n_biometric,
        n_telco=args.n_telco,
        n_utility=args.n_utility,
        output_dir=args.output_dir,
    )


if __name__ == "__main__":
    main()

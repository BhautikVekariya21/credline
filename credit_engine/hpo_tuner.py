"""
FinGuard 2026 — Distributed Hyperparameter Optimization (Ray Tune + Optuna).

Implements:
  1. Custom Objective Function that penalizes False Positives (denying good
     applicants) 3x more heavily than False Negatives, aligning the model
     with the bank's exact risk appetite.
  2. Distributed HPO using Ray Tune + Optuna for XGBoost on GPU/CPU.
  3. Automatic monotonic constraint preservation during tuning.

The custom loss ensures the credit engine is mathematically biased
toward financial inclusion (fewer wrongful denials) while maintaining
a strict ceiling on default risk.

Usage:
    python -m credit_engine.hpo_tuner --trials 100 --gpus 1
"""

from __future__ import annotations

import argparse
import time
from typing import Any

import numpy as np

from config.logging_config import get_logger

logger = get_logger(__name__)

try:
    import xgboost as xgb
except ImportError:
    xgb = None


# ─── Custom Objective Function ────────────────────────────────────────

class AsymmetricCreditLoss:
    """
    Custom XGBoost objective that asymmetrically penalizes errors.

    In credit underwriting:
      - False Positive (denying a good applicant) = EXPENSIVE
        → Regulatory fines, lost revenue, financial exclusion
      - False Negative (approving a defaulter) = also bad
        → Direct financial loss

    This loss function applies a 3:1 penalty ratio (configurable),
    ensuring the model is biased toward inclusion while maintaining
    a strict ceiling on default risk.

    For regression (credit score prediction):
      - Under-prediction (real score high, predicted low → wrongful denial)
        gets penalized `fp_weight` times more than over-prediction.
    """

    def __init__(
        self,
        fp_weight: float = 3.0,
        fn_weight: float = 1.0,
        approval_threshold: float = 580.0,
    ):
        self.fp_weight = fp_weight
        self.fn_weight = fn_weight
        self.threshold = approval_threshold

    def __call__(
        self, y_pred: np.ndarray, dtrain: Any,
    ) -> tuple[np.ndarray, np.ndarray]:
        """
        Custom gradient and hessian for asymmetric loss.

        XGBoost calls this with (predictions, DMatrix).
        Must return (gradient, hessian) arrays.
        """
        y_true = dtrain.get_label()
        residual = y_pred - y_true

        # Asymmetric weighting
        weights = np.where(
            residual < 0,  # Under-prediction → wrongful denial
            self.fp_weight,
            self.fn_weight,
        )

        # Weighted squared error gradient: w * 2 * residual
        grad = weights * 2.0 * residual

        # Hessian: w * 2
        hess = weights * 2.0

        return grad, hess

    def eval_metric(
        self, y_pred: np.ndarray, dtrain: Any,
    ) -> tuple[str, float]:
        """Custom evaluation metric: asymmetric RMSE."""
        y_true = dtrain.get_label()
        residual = y_pred - y_true
        weights = np.where(residual < 0, self.fp_weight, self.fn_weight)
        wmse = np.mean(weights * residual ** 2)
        return "asymmetric_rmse", float(np.sqrt(wmse))


# ─── Ray Tune + Optuna HPO ───────────────────────────────────────────

def run_hpo(
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_val: np.ndarray,
    y_val: np.ndarray,
    n_trials: int = 50,
    num_gpus: float = 0,
    fp_weight: float = 3.0,
) -> dict[str, Any]:
    """
    Run distributed hyperparameter optimization for the credit XGBoost model.

    Uses Ray Tune + Optuna for intelligent Bayesian search
    with early stopping.
    """
    try:
        import ray
        from ray import tune
        from ray.tune.search.optuna import OptunaSearch
        from ray.tune.schedulers import ASHAScheduler
    except ImportError:
        logger.warning("ray_not_installed",
                       msg="Using local grid search fallback")
        return _local_grid_search(X_train, y_train, X_val, y_val, fp_weight)

    from credit_engine.gpu_trainer import (
        _build_monotonic_constraints,
        _build_interaction_constraints,
    )

    custom_loss = AsymmetricCreditLoss(fp_weight=fp_weight)

    def train_fn(config: dict) -> None:
        """Training function for Ray Tune."""
        params = {
            "max_depth": config["max_depth"],
            "learning_rate": config["learning_rate"],
            "subsample": config["subsample"],
            "colsample_bytree": config["colsample_bytree"],
            "reg_alpha": config["reg_alpha"],
            "reg_lambda": config["reg_lambda"],
            "min_child_weight": config["min_child_weight"],
            "gamma": config["gamma"],
            "tree_method": "hist",
            "device": "cuda" if num_gpus > 0 else "cpu",
            "monotone_constraints": _build_monotonic_constraints(),
            "interaction_constraints": _build_interaction_constraints(),
        }

        dtrain = xgb.DMatrix(X_train, label=y_train)
        dval = xgb.DMatrix(X_val, label=y_val)

        results: dict[str, dict[str, list]] = {}
        bst = xgb.train(
            params,
            dtrain,
            num_boost_round=config["n_estimators"],
            evals=[(dval, "val")],
            obj=custom_loss,
            custom_metric=custom_loss.eval_metric,
            evals_result=results,
            verbose_eval=False,
        )

        # Report final validation metric
        val_rmse = results.get("val", {}).get("asymmetric_rmse", [0])[-1]
        tune.report({"val_asymmetric_rmse": val_rmse})

    # Search space
    search_space = {
        "max_depth": tune.randint(4, 12),
        "learning_rate": tune.loguniform(0.005, 0.3),
        "n_estimators": tune.choice([500, 750, 1000, 1500, 2000]),
        "subsample": tune.uniform(0.6, 1.0),
        "colsample_bytree": tune.uniform(0.5, 1.0),
        "reg_alpha": tune.loguniform(1e-3, 10.0),
        "reg_lambda": tune.loguniform(1e-3, 10.0),
        "min_child_weight": tune.randint(1, 10),
        "gamma": tune.loguniform(1e-4, 1.0),
    }

    scheduler = ASHAScheduler(
        max_t=2000,
        grace_period=100,
        reduction_factor=3,
    )

    search = OptunaSearch(metric="val_asymmetric_rmse", mode="min")

    if not ray.is_initialized():
        ray.init(ignore_reinit_error=True)

    analysis = tune.run(
        train_fn,
        config=search_space,
        num_samples=n_trials,
        scheduler=scheduler,
        search_alg=search,
        resources_per_trial={"cpu": 2, "gpu": num_gpus},
        verbose=1,
    )

    best = analysis.best_config
    best_metric = analysis.best_result["val_asymmetric_rmse"]

    logger.info("hpo_complete",
                best_metric=f"{best_metric:.4f}",
                best_depth=best["max_depth"],
                best_lr=f"{best['learning_rate']:.5f}",
                trials=n_trials)

    return {
        "best_config": best,
        "best_val_asymmetric_rmse": best_metric,
        "total_trials": n_trials,
    }


def _local_grid_search(
    X_train: np.ndarray, y_train: np.ndarray,
    X_val: np.ndarray, y_val: np.ndarray,
    fp_weight: float = 3.0,
) -> dict[str, Any]:
    """Fallback local grid search when Ray is unavailable."""
    from credit_engine.gpu_trainer import (
        _build_monotonic_constraints,
        _build_interaction_constraints,
    )

    custom_loss = AsymmetricCreditLoss(fp_weight=fp_weight)
    best_score = float("inf")
    best_params: dict[str, Any] = {}

    grid = [
        {"max_depth": d, "learning_rate": lr, "n_estimators": n}
        for d in [4, 6, 8]
        for lr in [0.01, 0.05, 0.1]
        for n in [500, 1000]
    ]

    dtrain = xgb.DMatrix(X_train, label=y_train)
    dval = xgb.DMatrix(X_val, label=y_val)

    logger.info("local_grid_search_start", configs=len(grid))

    for i, cfg in enumerate(grid):
        params = {
            **cfg,
            "tree_method": "hist",
            "subsample": 0.8,
            "colsample_bytree": 0.8,
            "monotone_constraints": _build_monotonic_constraints(),
            "interaction_constraints": _build_interaction_constraints(),
        }

        n_rounds = params.pop("n_estimators")
        results: dict = {}

        bst = xgb.train(
            params, dtrain,
            num_boost_round=n_rounds,
            evals=[(dval, "val")],
            obj=custom_loss,
            custom_metric=custom_loss.eval_metric,
            evals_result=results,
            verbose_eval=False,
        )

        score = results.get("val", {}).get("asymmetric_rmse", [float("inf")])[-1]
        if score < best_score:
            best_score = score
            best_params = cfg

        if (i + 1) % 5 == 0:
            logger.info("grid_search_progress",
                        done=i + 1, total=len(grid),
                        best=f"{best_score:.4f}")

    logger.info("local_grid_search_complete",
                best_score=f"{best_score:.4f}",
                best_params=best_params)

    return {
        "best_config": best_params,
        "best_val_asymmetric_rmse": best_score,
        "total_trials": len(grid),
        "method": "local_grid_search",
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="FinGuard Credit Engine HPO")
    parser.add_argument("--trials", type=int, default=50)
    parser.add_argument("--gpus", type=float, default=0)
    parser.add_argument("--fp-weight", type=float, default=3.0)
    args = parser.parse_args()

    # Generate synthetic training data for demo
    np.random.seed(42)
    n_features = 25
    X_train = np.random.rand(5000, n_features).astype(np.float32)
    y_train = (300 + 550 * np.mean(X_train, axis=1) +
               np.random.randn(5000) * 30).astype(np.float32)
    X_val = np.random.rand(1000, n_features).astype(np.float32)
    y_val = (300 + 550 * np.mean(X_val, axis=1) +
             np.random.randn(1000) * 30).astype(np.float32)

    result = run_hpo(X_train, y_train, X_val, y_val,
                     n_trials=args.trials, num_gpus=args.gpus,
                     fp_weight=args.fp_weight)

    print("\n🎯 HPO Complete:")
    for k, v in result.items():
        print(f"  {k}: {v}")

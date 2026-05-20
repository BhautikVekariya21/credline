"""
FinGuard 2026 — ONNX Model Exporter for Edge Deployment.

Exports the BiometricHead (1D-CNN + LSTM) model to ONNX format
for on-device inference via WebAssembly/ONNX Runtime Web.

The exported model processes raw sensor + keystroke data and produces
a 64-dim "Behavioral Vector" (identity embedding) entirely on-device.
No raw PII leaves the user's browser.

Usage:
    python -m edge.onnx_exporter --output artifacts/biometric_edge.onnx
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

import numpy as np
import torch

from config.logging_config import get_logger
from models.biometric.biometric_head import BiometricHead

logger = get_logger(__name__)


class BiometricONNXExporter:
    """
    Exports BiometricHead to ONNX with optimization for edge devices.

    The exported model:
      Input 1: sensor_data  [batch, 6, time_steps]  (gyro + accel)
      Input 2: keystroke_data [batch, 32]            (inter-key intervals)
      Output:  embedding     [batch, 64]             (behavioral vector)
    """

    def __init__(
        self,
        model: BiometricHead | None = None,
        checkpoint_path: str | None = None,
    ):
        if model is not None:
            self.model = model
        else:
            self.model = BiometricHead()
            if checkpoint_path and os.path.exists(checkpoint_path):
                state = torch.load(checkpoint_path, map_location="cpu")
                self.model.load_state_dict(state)
                logger.info("loaded_checkpoint", path=checkpoint_path)

        self.model.eval()

    def export(
        self,
        output_path: str = "artifacts/biometric_edge.onnx",
        time_steps: int = 100,
        opset_version: int = 17,
        optimize: bool = True,
    ) -> str:
        """
        Export the model to ONNX format.

        Args:
            output_path: Where to save the .onnx file.
            time_steps: Expected sensor sequence length.
            opset_version: ONNX opset version (17 has best LSTM support).
            optimize: Whether to run ONNX optimization passes.

        Returns:
            Path to the exported ONNX file.
        """
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        # Create dummy inputs matching BiometricHead's forward signature
        dummy_sensor = torch.randn(1, 6, time_steps)
        dummy_keystroke = torch.randn(1, 32)

        # Wrap model to only return the embedding tensor (not a dict)
        wrapper = _EmbeddingOnlyWrapper(self.model)

        torch.onnx.export(
            wrapper,
            (dummy_sensor, dummy_keystroke),
            output_path,
            input_names=["sensor_data", "keystroke_data"],
            output_names=["behavioral_vector"],
            dynamic_axes={
                "sensor_data": {0: "batch", 2: "time_steps"},
                "keystroke_data": {0: "batch"},
                "behavioral_vector": {0: "batch"},
            },
            opset_version=opset_version,
            do_constant_folding=True,
        )

        logger.info("onnx_exported", path=output_path, size_kb=os.path.getsize(output_path) // 1024)

        if optimize:
            self._optimize_onnx(output_path)

        # Validate the exported model
        self._validate(output_path, dummy_sensor, dummy_keystroke)

        return output_path

    def _optimize_onnx(self, path: str) -> None:
        """Apply ONNX optimization passes for smaller/faster models."""
        try:
            import onnx
            from onnxruntime.transformers import optimizer

            model = onnx.load(path)
            optimized = optimizer.optimize_model(path, model_type="bert")
            optimized.save_model_to_file(path)
            logger.info("onnx_optimized", path=path)
        except ImportError:
            logger.warning("onnx_optimize_skipped", reason="onnxruntime not installed")
        except Exception as e:
            logger.warning("onnx_optimize_failed", error=str(e))

    def _validate(
        self, onnx_path: str,
        sensor: torch.Tensor, keystroke: torch.Tensor,
    ) -> None:
        """Validate ONNX output matches PyTorch output."""
        try:
            import onnxruntime as ort

            session = ort.InferenceSession(onnx_path)
            onnx_out = session.run(None, {
                "sensor_data": sensor.numpy(),
                "keystroke_data": keystroke.numpy(),
            })[0]

            with torch.no_grad():
                torch_out = self.model.get_embedding(sensor, keystroke).numpy()

            max_diff = np.abs(onnx_out - torch_out).max()
            logger.info("onnx_validated", max_diff=f"{max_diff:.6f}", match=max_diff < 1e-4)

        except ImportError:
            logger.warning("onnx_validation_skipped", reason="onnxruntime not installed")

    def export_quantized(
        self,
        output_path: str = "artifacts/biometric_edge_int8.onnx",
        time_steps: int = 100,
    ) -> str:
        """Export INT8 quantized model for ultra-fast edge inference."""
        base_path = output_path.replace("_int8", "")
        self.export(base_path, time_steps, optimize=False)

        try:
            from onnxruntime.quantization import quantize_dynamic, QuantType

            quantize_dynamic(
                base_path, output_path,
                weight_type=QuantType.QInt8,
            )
            logger.info("onnx_quantized",
                         path=output_path,
                         size_kb=os.path.getsize(output_path) // 1024)
            return output_path

        except ImportError:
            logger.warning("quantization_skipped", reason="onnxruntime not installed")
            return base_path


class _EmbeddingOnlyWrapper(torch.nn.Module):
    """Thin wrapper to make BiometricHead return a plain tensor for ONNX export."""

    def __init__(self, model: BiometricHead):
        super().__init__()
        self.model = model

    def forward(self, sensor_data: torch.Tensor, keystroke_data: torch.Tensor) -> torch.Tensor:
        return self.model.get_embedding(sensor_data, keystroke_data)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export BiometricHead to ONNX")
    parser.add_argument("--output", default="artifacts/biometric_edge.onnx")
    parser.add_argument("--checkpoint", default=None)
    parser.add_argument("--quantize", action="store_true")
    args = parser.parse_args()

    exporter = BiometricONNXExporter(checkpoint_path=args.checkpoint)

    if args.quantize:
        exporter.export_quantized(args.output)
    else:
        exporter.export(args.output)

    print(f"✅ Exported to {args.output}")

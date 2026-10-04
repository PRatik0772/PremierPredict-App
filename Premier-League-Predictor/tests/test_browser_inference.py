import subprocess
import json
from pathlib import Path

from dashboard_contract import DEFAULT_PATH


def test_browser_inference_matches_trained_models(tmp_path):
    root = Path(__file__).parents[2]
    esbuild = sorted(root.glob("node_modules/.pnpm/esbuild@*/node_modules/esbuild/bin/esbuild"))[-1]
    compiled = tmp_path / "model-inference.mjs"
    subprocess.run([
        str(esbuild), str(root / "artifacts/premierpredict-dashboard/src/lib/model-inference.ts"),
        "--bundle", "--platform=node", "--format=esm", f"--outfile={compiled}",
    ], check=True, capture_output=True, text=True)
    result = subprocess.run([
        "node", str(Path(__file__).with_name("browser_inference_checks.mjs")),
        str(compiled), str(DEFAULT_PATH),
    ], check=True, capture_output=True, text=True)
    data = json.loads(DEFAULT_PATH.read_text())
    expected = (len(data["predictionInputs"]) + 12) * len(data["metrics"])
    assert f"{expected} model predictions matched" in result.stdout
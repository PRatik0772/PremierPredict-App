"""Generate feedback-ready reports from the actual dashboard evaluation artifact."""
from __future__ import annotations

import csv
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).parent
PUBLIC = ROOT.parent / "artifacts/premierpredict-dashboard/public"
PAYLOAD = PUBLIC / "data/premierpredict.json"
OUT = PUBLIC / "reports"
OUTCOMES = {"H": "Home win", "D": "Draw", "A": "Away win"}
MODELS = ["Logistic Regression", "Decision Tree", "Random Forest", "Gradient Boosting", "XGBoost"]


def validated_results(payload: dict) -> tuple[list[dict], list[dict]]:
    """Recompute every reported metric from its confusion matrix; reject drift."""
    summary = payload["evaluationSummary"]
    supports = summary["outcomeCounts"]["test"]
    total = summary["testMatches"]
    if sum(supports.values()) != total:
        raise ValueError("Holdout support does not sum to the test size")
    rows, overview = [], []
    for model in MODELS:
        matrix = payload["confusionMatrices"][model]
        if matrix["labels"] != list(OUTCOMES):
            raise ValueError(f"Unexpected class ordering: {model}")
        values = matrix["values"]
        if len(values) != 3 or any(len(row) != 3 for row in values):
            raise ValueError(f"Invalid confusion matrix: {model}")
        class_rows = []
        for i, (code, label) in enumerate(OUTCOMES.items()):
            support = sum(values[i])
            predicted = sum(row[i] for row in values)
            precision = values[i][i] / predicted if predicted else 0.0
            recall = values[i][i] / support if support else 0.0
            f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
            published = next(row for row in payload["classMetrics"][model] if row["outcome"] == code)
            if support != supports[code] or published["support"] != support:
                raise ValueError(f"Models do not share the same class support: {model}")
            for field, computed in [("precision", precision), ("recall", recall), ("f1", f1)]:
                if not math.isclose(published[field], computed, abs_tol=1e-12):
                    raise ValueError(f"Class metric drift: {model}/{code}/{field}")
            class_rows.append(dict(model=model, outcome=label, precision=precision,
                                   recall=recall, f1=f1, support=support))
        metric = dict(model=model, accuracy=sum(values[i][i] for i in range(3)) / total,
                      macroPrecision=sum(row["precision"] for row in class_rows) / 3,
                      macroRecall=sum(row["recall"] for row in class_rows) / 3,
                      macroF1=sum(row["f1"] for row in class_rows) / 3)
        published = next(row for row in payload["metrics"] if row["model"] == model)
        for field in ["accuracy", "macroPrecision", "macroF1"]:
            if not math.isclose(published[field], metric[field], abs_tol=1e-12):
                raise ValueError(f"Aggregate metric drift: {model}/{field}")
        rows.extend(class_rows)
        overview.append(metric)
    majority = summary["trainingMajorityOutcome"]
    if majority != max(summary["outcomeCounts"]["train"], key=summary["outcomeCounts"]["train"].get):
        raise ValueError("Baseline must use the training-majority class")
    accuracy = supports[majority] / total
    baseline = []
    for code, label in OUTCOMES.items():
        precision, recall = (accuracy, 1.0) if code == majority else (0.0, 0.0)
        baseline.append(dict(model=f"Majority baseline ({majority})", outcome=label,
                             precision=precision, recall=recall,
                             f1=2 * precision / (precision + 1) if recall else 0.0,
                             support=supports[code]))
    rows.extend(baseline)
    overview.append(dict(model=f"Majority baseline ({majority})", accuracy=accuracy,
                         macroPrecision=accuracy / 3, macroRecall=1 / 3,
                         macroF1=sum(row["f1"] for row in baseline) / 3))
    return rows, overview


def report_sections(payload: dict, rows: list[dict], overview: list[dict], periods: dict, digest: str):
    summary, provenance = payload["evaluationSummary"], payload["provenance"]
    pc = lambda value: f"{value * 100:.2f}%"
    leaders = {field: max(overview[:-1], key=lambda row: row[field])["model"]
               for field in ["accuracy", "macroF1", "macroPrecision"]}
    draw_correct = payload["confusionMatrices"]["Logistic Regression"]["values"][1][1]
    draw_support = summary["outcomeCounts"]["test"]["D"]
    return [
        ("paragraph", "Replacement technical section addressing the teacher feedback dated 25 September 2026. "
         "This is a newly generated evaluation update, not an edit of the unavailable original team report."),
        ("heading", "1. Completed implementation and common evaluation protocol"),
        ("paragraph", f"All five models and the simple majority baseline are implemented and evaluated. "
         f"The same {summary['trainMatches']:,} training matches and {summary['testMatches']:,} held-out "
         f"matches are used for every model, with 40 predictor inputs. No model is reported on a different test period."),
        ("paragraph", f"Training: season-start years 2008–2022 ({periods['train']}). "
         f"Testing: season-start years 2023–2025 ({periods['test']}). Seasons are start-year labels, "
         "so the 2025 season includes matches in 2026. This is a chronological holdout, not a random split."),
        ("paragraph", "Recent form, venue win rates and goals use matches strictly before the match kickoff. "
         "Historical table features use the previous season. Imputation and scaling are fitted on training "
         "rows, not the holdout. The dashboard uses fixed local model configurations; separate upstream "
         "Optuna experiments are not claimed as these results."),
        ("paragraph", f"Holdout support is {summary['outcomeCounts']['test']['H']} Home wins, "
         f"{summary['outcomeCounts']['test']['D']} Draws and {summary['outcomeCounts']['test']['A']} Away wins. "
         "Precision is correct predictions divided by predictions of that class; recall is correct predictions "
         "divided by actual examples of that class; F1 is their harmonic mean. Macro averages give each class equal weight. "
         "Undefined precision/F1 is reported as zero, matching sklearn zero_division=0."),
        ("table", (["Model", "Accuracy", "Macro precision", "Macro recall", "Macro F1"],
                   [[m["model"], pc(m["accuracy"]), pc(m["macroPrecision"]), pc(m["macroRecall"]), pc(m["macroF1"])] for m in overview])),
        ("heading_page", "2. Each model's Home / Draw / Away results"),
        ("paragraph", "These values are recomputed from the published confusion matrices and checked against "
         "the dashboard class metrics. Each model has identical test support; every value below is a percentage."),
        ("table", (["Model", "Outcome", "Precision", "Recall", "F1", "Support"],
                   [[r["model"], r["outcome"], pc(r["precision"]), pc(r["recall"]), pc(r["f1"]), str(r["support"])] for r in rows])),
        ("heading_page", "3. Interpretation and reconciliation of earlier figures"),
        ("paragraph", f"{leaders['accuracy']} has the highest current accuracy, {leaders['macroF1']} the highest "
         f"macro F1 and {leaders['macroPrecision']} the highest macro precision. Accuracy alone is insufficient: Logistic Regression "
         f"correctly identifies {draw_correct} of the {draw_support} draws. The class table "
         "makes this weakness visible instead of presenting one score as complete evidence of quality."),
        ("paragraph", f"The comparable baseline always predicts the training-majority class ({majority_label(summary)}), "
         f"scoring {pc(summary['holdoutMajorityBaselineAccuracy'])} on the same holdout. "
         f"The {pc(summary['datasetMajorityBaselineAccuracy'])} full-dataset majority prevalence is not a comparable test score."),
        ("paragraph", "The feedback quotes an earlier Decision Tree accuracy of about 43.6% and a Logistic "
         "Regression screenshot of 51.8%. The original report, split and configuration for those figures "
         "are unavailable, so their experimental provenance cannot be reconciled. They must not be mixed "
         "with the current verified run. Current values are Decision Tree "
         f"{pc(next(m['accuracy'] for m in overview if m['model'] == 'Decision Tree'))} and Logistic Regression "
         f"{pc(next(m['accuracy'] for m in overview if m['model'] == 'Logistic Regression'))}. "
         "Use this dated, fully specified evaluation consistently; label any retained older screenshots as historical."),
        ("heading", "4. Consistent implementation status"),
        ("table", (["Component", "Current status", "Evidence"],
                   [["Majority baseline", "Completed", "Same-period score and class results above"],
                    ["Logistic Regression / Decision Tree / Random Forest", "Completed", "Trained parameters, predictions and holdout results"],
                    ["Gradient Boosting / XGBoost", "Completed", "Genuine distinct models; XGBoost exports 600 trees"],
                    ["Evaluation and dashboard", "Completed", "Five-model and class-level results; all models use one split"],
                    ["Player-exclusion demonstration", "Completed", "Reruns trained parameters; reset restores the baseline"],
                    ["Live bookmaker comparison", "Implemented separately", "Public ESPN upcoming fixtures and complete three-way listed prices"],
                    ["Original report revision / final submission", "Not claimed", "Original team report was not provided"]])),
        ("heading_page", "5. Limits, provenance and reproducibility"),
        ("paragraph", f"All {summary['ratedTestMatchCount']:,} holdout matches have season-matched FIFA/FC ratings. "
         f"The {summary['imputedPre2015MatchCount']:,} pre-2015 training rows retain missing-rating flags and "
         "use training-only median imputation. Prior-season standings are reconstructed from checked-in "
         "match results, not queried from a live Snowflake warehouse."),
        ("paragraph", f"The model history ends at {provenance['prediction_as_of']}. Live bookmaker odds are "
         "retrieved separately for actual upcoming fixtures and are not any of the 40 model inputs. They do "
         "not retrain the models or refresh team form. Only complete Home/Draw/Away markets are compared. "
         "Decimal implied probability is 1/price; margin-normalized probability divides each implied value "
         "by their sum. This comparison is descriptive, not proof of profitable betting or a historical "
         "bookmaker benchmark. Prices have a browser retrieval timestamp; the public feed does not provide "
         "a reliable quote-update timestamp, guaranteed coverage or a streaming/SLA commitment."),
        ("paragraph", "Reproduce: python -m pytest tests -q; regenerate model data with "
         "python generate_dashboard_data.py; regenerate this report with python build_evaluation_report.py. "
         "The frontend live-odds parser tests run with pnpm --filter @workspace/premierpredict-dashboard "
         "exec tsx --test tests/live-odds.test.ts."),
        ("paragraph", f"Evaluation artifact generated at {provenance['generated_at']}. "
         f"Artifact SHA-256: {digest}. Sources: checked-in PremierPredict data; "
         f"{provenance['repository']} (upstream source {provenance['source_commit']}); "
         "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard for live fixture/odds display."),
    ]


def majority_label(summary: dict) -> str:
    return OUTCOMES[summary["trainingMajorityOutcome"]]


def write_documents(sections: list, destination: Path):
    from docx import Document
    from docx.shared import Inches, Pt
    from docx.oxml import OxmlElement
    destination.mkdir(parents=True, exist_ok=True)
    doc = Document()
    section = doc.sections[0]
    section.top_margin = section.bottom_margin = Inches(0.65)
    section.left_margin = section.right_margin = Inches(0.6)
    normal = doc.styles["Normal"]
    normal.font.name, normal.font.size = "Calibri", Pt(10)
    normal.paragraph_format.space_after = Pt(7)
    doc.add_heading("PremierPredict — Technical Evaluation Update", 0)
    markdown = ["# PremierPredict — Technical Evaluation Update", ""]
    for kind, content in sections:
        if kind.startswith("heading"):
            heading = doc.add_heading(content, 1)
            if kind == "heading_page":
                heading.paragraph_format.page_break_before = True
            markdown.extend(["## " + content, ""])
        elif kind == "paragraph":
            doc.add_paragraph(content)
            markdown.extend([content, ""])
        elif kind == "table":
            headers, rows = content
            table = doc.add_table(rows=1, cols=len(headers))
            table.style = "Table Grid"
            for cell, value in zip(table.rows[0].cells, headers):
                cell.text = value
                for run in cell.paragraphs[0].runs:
                    run.bold = True
            repeat = OxmlElement("w:tblHeader")
            table.rows[0]._tr.get_or_add_trPr().append(repeat)
            for values in rows:
                cells = table.add_row().cells
                for cell, value in zip(cells, values):
                    cell.text = value
                cant_split = OxmlElement("w:cantSplit")
                table.rows[-1]._tr.get_or_add_trPr().append(cant_split)
            doc.add_paragraph()
            markdown.append("| " + " | ".join(headers) + " |")
            markdown.append("| " + " | ".join("---" for _ in headers) + " |")
            markdown.extend("| " + " | ".join(row) + " |" for row in rows)
            markdown.append("")
    doc.core_properties.title = "PremierPredict — Technical Evaluation Update"
    doc.save(destination / "technical-evaluation-update.docx")
    content = "\n".join(markdown)
    (destination / "technical-evaluation-update.md").write_text(content)
    (ROOT / "TECHNICAL_EVALUATION_UPDATE.md").write_text(content)


def main():
    from model_pipeline import load_matches
    raw = PAYLOAD.read_bytes()
    payload = json.loads(raw)
    rows, overview = validated_results(payload)
    matches = load_matches()
    train, test = matches[matches.season <= 2022], matches[matches.season >= 2023]
    if len(train) != payload["evaluationSummary"]["trainMatches"] or len(test) != payload["evaluationSummary"]["testMatches"]:
        raise ValueError("Source workbook no longer matches the evaluation artifact")
    periods = {name: f"{frame.kickoff.min():%d %B %Y} to {frame.kickoff.max():%d %B %Y}"
               for name, frame in [("train", train), ("test", test)]}
    write_documents(report_sections(payload, rows, overview, periods, hashlib.sha256(raw).hexdigest()), OUT)
    with (OUT / "model-class-metrics.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    print(f"Generated DOCX, Markdown and CSV: {len(rows)} class rows; {len(overview)} models/baseline. {periods}")


if __name__ == "__main__":
    main()
"""Streamlit dashboard for PremierPredict."""

from __future__ import annotations

import pandas as pd
import streamlit as st

from model_pipeline import build_prediction_features, train_models


st.set_page_config(
    page_title="PremierPredict",
    page_icon="⚽",
    layout="wide",
)


@st.cache_resource(show_spinner="Training the prediction models, including XGBoost...")
def get_bundle():
    return train_models(history_source="matches")


def result_label(value: str) -> str:
    return {"H": "Home Win", "D": "Draw", "A": "Away Win"}[value]


bundle = get_bundle()

st.title("PremierPredict")
st.caption("English Premier League match outcome prediction")
st.caption("Historical standings: reconstructed from checked-in prior-season match results. All models use fixed configurations.")
st.caption("Available models: " + " · ".join(bundle.models))

metric_one, metric_two, metric_three, metric_four = st.columns(4)
metric_one.metric("Historical matches", f"{len(bundle.matches):,}")
metric_two.metric("Features", len(bundle.features.columns))
metric_three.metric("Training seasons", "2008–2022")
metric_four.metric("Test seasons", "2023–2025")

page = st.sidebar.radio(
    "Dashboard",
    ["Predict a match", "Model evaluation", "Dataset explorer"],
)

if page == "Predict a match":
    st.header("Predict a match")
    st.write(
        "Select two teams from the latest available season. The dashboard uses "
        "recent form, scoring, win rates, and home/away performance."
    )

    home_team = st.selectbox("Home team", bundle.teams, index=0)
    away_options = [team for team in bundle.teams if team != home_team]
    away_team = st.selectbox("Away team", away_options, index=0)
    model_name = st.selectbox("Model", list(bundle.models))

    if st.button("Generate prediction", type="primary"):
        prediction_features = build_prediction_features(bundle, home_team, away_team)
        model = bundle.models[model_name]
        probabilities = model.predict_proba(prediction_features)[0]
        probability_table = pd.DataFrame(
            {
                "Outcome": [result_label(label) for label in model.classes_],
                "Probability": probabilities,
            }
        ).sort_values("Probability", ascending=False)
        predicted = model.predict(prediction_features)[0]

        st.success(
            f"{model_name} predicts **{result_label(predicted)}**: "
            f"{home_team} vs {away_team}"
        )
        st.bar_chart(probability_table.set_index("Outcome"))
        st.dataframe(
            probability_table.style.format({"Probability": "{:.1%}"}),
            use_container_width=True,
            hide_index=True,
        )

elif page == "Model evaluation":
    st.header("Model evaluation")
    st.write(
        "All models, including XGBoost, are evaluated on the same 2023–2025 holdout. The training "
        "period is 2008–2022, and no future match outcomes are used as features."
    )
    summary = bundle.evaluation_summary
    total_col, train_col, test_col, baseline_col = st.columns(4)
    total_col.metric("Valid unique matches", f"{summary['validUniqueMatches']:,}")
    train_col.metric("Training matches", f"{summary['trainMatches']:,}")
    test_col.metric("Held-out matches", f"{summary['testMatches']:,}")
    baseline_col.metric(
        "Training-majority baseline",
        f"{summary['holdoutMajorityBaselineAccuracy']:.1%}",
        help=(
            f"Always predict {result_label(summary['trainingMajorityOutcome'])}, "
            "the most common training outcome."
        ),
    )
    outcome_counts = pd.DataFrame(summary["outcomeCounts"]).rename(
        index={"H": "Home win", "D": "Draw", "A": "Away win"},
        columns={"all": "All matches", "train": "Training", "test": "Held out"},
    )
    st.subheader("Outcome counts")
    st.dataframe(outcome_counts, use_container_width=True)
    st.caption(
        f"The full-dataset majority outcome is {result_label(summary['datasetMajorityOutcome'])} "
        f"at {summary['datasetMajorityBaselineAccuracy']:.2%}; this is outcome prevalence, "
        "not a holdout benchmark."
    )
    st.info(bundle.provenance["ratings_method"])
    st.dataframe(
        bundle.metrics.style.format(
            {
                "Accuracy": "{:.1%}",
                "Macro F1": "{:.3f}",
                "Macro Precision": "{:.3f}",
                "Draw F1": "{:.3f}",
            }
        ),
        use_container_width=True,
        hide_index=True,
    )
    st.bar_chart(bundle.metrics.set_index("Model")[["Accuracy", "Macro F1"]])

    selected_model = st.selectbox("Classification report", list(bundle.models))
    report = pd.DataFrame(bundle.reports[selected_model]).T
    st.dataframe(
        report.style.format(
            {
                "precision": "{:.3f}",
                "recall": "{:.3f}",
                "f1-score": "{:.3f}",
            }
        ),
        use_container_width=True,
    )
    st.subheader("Confusion matrix")
    matrix = pd.DataFrame(
        bundle.confusion_matrices[selected_model],
        index=["Actual Home", "Actual Draw", "Actual Away"],
        columns=["Predicted Home", "Predicted Draw", "Predicted Away"],
    )
    st.dataframe(matrix, use_container_width=True)
    st.info(
        "Draw performance should be interpreted carefully. A high overall "
        "accuracy can still hide weak draw detection."
    )

else:
    st.header("Dataset explorer")
    matches = bundle.matches
    left, right = st.columns(2)
    with left:
        st.metric("First match", matches["kickoff"].min().strftime("%d %b %Y"))
        st.metric("Last match", matches["kickoff"].max().strftime("%d %b %Y"))
    with right:
        st.metric("Teams in latest season", len(bundle.teams))
        st.metric("Latest season", bundle.latest_season)

    st.subheader("Outcome distribution")
    outcome_counts = (
        matches["result"]
        .map(result_label)
        .value_counts()
        .rename_axis("Outcome")
        .to_frame("Matches")
    )
    st.bar_chart(outcome_counts)

    st.subheader("Model features")
    st.dataframe(
        pd.DataFrame({"Feature": bundle.features.columns}),
        use_container_width=True,
        hide_index=True,
    )

    st.subheader("Recent matches")
    recent = matches[
        [
            "season",
            "kickoff",
            "homeTeam_name",
            "awayTeam_name",
            "homeTeam_score",
            "awayTeam_score",
            "result",
        ]
    ].tail(20)
    st.dataframe(recent, use_container_width=True, hide_index=True)
from agents import Agent


tuning_agent = Agent(
    name="EPL Model Tuning Agent",

    instructions="""
You are an AI agent for a Premier League match prediction
machine learning project.

The project uses three classification models:

1. Logistic Regression
2. Decision Tree
3. Random Forest

Your job is to analyse the actual machine learning results
provided to you.

When analysing the results:

- Compare accuracy.
- Compare weighted F1-score.
- Compare macro F1-score.
- Examine class-level precision, recall and F1-score.
- Pay particular attention to the prediction of Away (A),
  Draw (D), and Home (H).
- Identify weaknesses in the models.
- Explain possible reasons for differences in performance.
- Do not invent results.
- Do not invent data.
- Do not change the reported results.
- Base your analysis only on the results provided.

You are an analysis agent, not the machine learning
training process itself.
""",
)

print("AI Tuning Agent created successfully")



from agents import Runner


def analyse_model_results():

    results = """
Premier League Predictor Model Results

Logistic Regression:
Accuracy: 0.4964
Weighted F1: 0.45
Macro F1: 0.41

Decision Tree:
Accuracy: 0.4338
Weighted F1: 0.45
Macro F1: 0.43

Random Forest:
Accuracy: 0.4900
Weighted F1: 0.48
Macro F1: 0.45

Class-level observations:

Logistic Regression:
Away (A) recall: 0.68
Draw (D) recall: 0.05
Home (H) recall: 0.62

Decision Tree:
Away (A) recall: 0.31
Draw (D) recall: 0.57
Home (H) recall: 0.45

Random Forest:
Away (A) recall: 0.54
Draw (D) recall: 0.22
Home (H) recall: 0.60
"""

    prompt = f"""
Analyse the following actual Premier League prediction
model results.

{results}

Provide:
1. A comparison of the three models.
2. The main strengths of each model.
3. The main weaknesses of each model.
4. An explanation of the difficulty predicting draws.
5. Suggestions for possible future improvement.

Do not invent any additional results.
"""

    result = Runner.run_sync(
        tuning_agent,
        prompt
    )

    print("\n" + "=" * 60)
    print("AI MODEL ANALYSIS")
    print("=" * 60)
    print(result.final_output)


if __name__ == "__main__":
    analyse_model_results()
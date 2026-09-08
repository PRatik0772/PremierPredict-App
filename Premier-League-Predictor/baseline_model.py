from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report

# Convert the H/D/A match outcomes into integer class labels for scikit-learn.
# The test set is transformed with the same encoder so the mapping stays consistent.
label_encoder = LabelEncoder()
 
y_train_encoded = label_encoder.fit_transform(y_train)
y_test_encoded = label_encoder.transform(y_test)
 
print("Classes:", label_encoder.classes_)
 
 
# Standardise the predictors to zero mean and unit variance. Logistic Regression is
# sensitive to feature scale, and our features span very different ranges (league
# position, points, win rates, player ratings). The scaler is fitted on the training
# data only and then applied to the test data, so no test information leaks into training.
scaler = StandardScaler()
 
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)
 
 
# Logistic Regression serves as the baseline classifier. It is linear and easy to
# interpret, which makes it a fair reference point for judging whether the Random
# Forest is actually learning nonlinear structure in the data.
# max_iter is raised to 1000 to allow the solver to converge on the scaled features;
# random_state fixes the seed so results are reproducible.
baseline_model = LogisticRegression(
    max_iter=1000,
    random_state=42
)
 
 
# Fit the baseline on the training split.
baseline_model.fit(
    X_train_scaled,
    y_train_encoded
)
 
 
# Predict match outcomes for the held-out test matches.
y_pred_baseline = baseline_model.predict(X_test_scaled)
 
 
# Overall proportion of correctly predicted matches. Because home wins make up
# roughly 45% of the dataset, accuracy alone is not a sufficient measure here.
baseline_accuracy = accuracy_score(
    y_test_encoded,
    y_pred_baseline
)
 
print("\nBaseline Accuracy:")
print(baseline_accuracy)
 
 
# Per-class precision, recall and F1. This shows how the model performs on each of
# the three outcomes separately, and in particular whether draws (the minority class)
# are being predicted at all or simply absorbed into the majority classes.
print("\nBaseline Classification Report:")
 
print(
    classification_report(
        y_test_encoded,
        y_pred_baseline,
        target_names=label_encoder.classes_
    )
)
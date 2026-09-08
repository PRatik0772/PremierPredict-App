# PremierPredict on Replit

## Main preview

The main visible app is the Vite/React dashboard in
`artifacts/premierpredict-dashboard`.

- Managed service: `artifacts/premierpredict-dashboard: web`
- Development route: `/premierpredict/`
- Development command: `pnpm --filter @workspace/premierpredict-dashboard run dev`
- Build and type-check: `pnpm run build`

The service receives `PORT` and `BASE_PATH` from its artifact configuration.

## Python modelling pipeline

The reproducible Python/Streamlit pipeline is in `Premier-League-Predictor`.
Its local datasets do not require credentials. Snowflake-backed scripts require
`SNOWFLAKE_USER`, `SNOWFLAKE_PASSWORD`, and `SNOWFLAKE_ACCOUNT` as Replit
Secrets; optional defaults are documented in that directory's README.

Keep the existing React dashboard and Python pipeline structure intact.
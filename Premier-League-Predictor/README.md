This is a premier league score prediction model. We have been trying to implement a proper data science project so that we will be able to know the real world working scenario.
This is just a learning project, so the codebase might not be same as in real world.

## Local setup

Install the Python dependencies:

```bash
python -m pip install -r requirements.txt
```

The local datasets are stored in `datasets/`. Scripts that only read those
files can run without Snowflake credentials. Scripts that use Snowflake require
these values to be configured as Replit Secrets or environment variables:

- `SNOWFLAKE_USER`
- `SNOWFLAKE_PASSWORD`
- `SNOWFLAKE_ACCOUNT`
- `SNOWFLAKE_WAREHOUSE` (optional; defaults to `COMPUTE_WH`)
- `SNOWFLAKE_DATABASE` (optional; defaults to `trail`)
- `SNOWFLAKE_SCHEMA` (optional; defaults to `trial_schema`)

Never commit credentials or a `.env` file to the repository.

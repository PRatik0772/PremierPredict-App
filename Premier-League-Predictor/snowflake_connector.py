import os

import snowflake.connector


def _required_env(name):
    value = os.getenv(name)
    if not value:
        raise RuntimeError(
            f"Missing {name}. Set the Snowflake connection values in Replit Secrets "
            "before running a workflow that uses Snowflake."
        )
    return value


def snowflake_connector_init():
    connection = snowflake.connector.connect(
        user=_required_env("SNOWFLAKE_USER"),
        password=_required_env("SNOWFLAKE_PASSWORD"),
        account=_required_env("SNOWFLAKE_ACCOUNT"),
        warehouse=os.getenv("SNOWFLAKE_WAREHOUSE", "COMPUTE_WH"),
        database=os.getenv("SNOWFLAKE_DATABASE", "trail"),
        schema=os.getenv("SNOWFLAKE_SCHEMA", "trial_schema"),
    )

    print("Connected to Snowflake successfully")
    return connection
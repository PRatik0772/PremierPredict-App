import os
import pandas as pd
from snowflake_connector import snowflake_connector_init

file_path = os.getcwd() + '/datasets/history_points_table.xlsx'

# Get all sheet names
sheet_names = pd.ExcelFile(file_path).sheet_names

data = {}

for sheet in sheet_names:
    # Extract year from sheet name
    year = sheet.split('_')[-1]

    sheet_type = sheet.split('_')[0]

    # Create data_2020, data_2021, etc.
    variable_name = f'data_{year}'

    # Read the sheet
    df = pd.read_excel(file_path, sheet_name=sheet)

    df.columns = [
        f'{column}_{sheet_type}'
        for column in df.columns
    ]

    if variable_name not in data:
        data[variable_name] = df
    else:
        # Merge side-by-side
        data[variable_name] = pd.concat(
            [data[variable_name], df],
            axis=1
        )

con = snowflake_connector_init()


#creating an aggregate table in snowflake from 4 sheets in history dataset present in excel file for each year
for year in data:
    table_name = year
    columns = data[year].columns.tolist()
    snowflake_column_name = []
    for column in columns:
        if column.split('_')[0] in ('name', 'shortName','abbr'):
            snowflake_column_name.append(column + ' varchar')
        else:
            snowflake_column_name.append(column + ' number')
    column_definition = ", ".join(snowflake_column_name)

    sql = f'''Create  or Replace table {table_name}
       ({column_definition});'''

    print(sql)

    con.cursor().execute(sql)

    for value in data[year].values:
        value_list = value.tolist()
        value_list = [
        x.replace("'", "") if isinstance(x, str) else x
        for x in value_list
    ]
        sql = f'''
        insert into {table_name}
            select {str(value_list)[1:-1]};'''
        print(sql)
        con.cursor().execute(sql)



# created an aggreagte table that contains overall team performance for 2008 to 2026
sql = '''CREATE OR REPLACE TABLE HISTORICAL_TEAM_PERFORMANCE AS

SELECT
    2008 AS SEASON,
    ID_TEAM AS TEAM_ID,
    TEAM_KEY_OVERALL AS TEAM_KEY,
    NAME_TEAM AS TEAM_NAME,
    POSITION_OVERALL AS POSITION,
    STARTINGPOSITION_OVERALL,
    PLAYED_OVERALL AS PLAYED,
    WON_OVERALL AS WON,
    DRAWN_OVERALL AS DRAWN,
    LOST_OVERALL AS LOST,
    GOALSFOR_OVERALL AS GOALS_FOR,
    GOALSAGAINST_OVERALL AS GOALS_AGAINST,
    POINTS_OVERALL AS POINTS
FROM DATA_2008

UNION ALL

SELECT
    2009,
    ID_TEAM,
    TEAM_KEY_OVERALL,
    NAME_TEAM,
    POSITION_OVERALL,
    STARTINGPOSITION_OVERALL,
    PLAYED_OVERALL,
    WON_OVERALL,
    DRAWN_OVERALL,
    LOST_OVERALL,
    GOALSFOR_OVERALL,
    GOALSAGAINST_OVERALL,
    POINTS_OVERALL
FROM DATA_2009

UNION ALL

SELECT
    2010,
    ID_TEAM,
    TEAM_KEY_OVERALL,
    NAME_TEAM,
    POSITION_OVERALL,
    STARTINGPOSITION_OVERALL,
    PLAYED_OVERALL,
    WON_OVERALL,
    DRAWN_OVERALL,
    LOST_OVERALL,
    GOALSFOR_OVERALL,
    GOALSAGAINST_OVERALL,
    POINTS_OVERALL
FROM DATA_2010

UNION ALL

SELECT
    2011,
    ID_TEAM,
    TEAM_KEY_OVERALL,
    NAME_TEAM,
    POSITION_OVERALL,
    STARTINGPOSITION_OVERALL,
    PLAYED_OVERALL,
    WON_OVERALL,
    DRAWN_OVERALL,
    LOST_OVERALL,
    GOALSFOR_OVERALL,
    GOALSAGAINST_OVERALL,
    POINTS_OVERALL
FROM DATA_2011

UNION ALL

SELECT
    2012,
    ID_TEAM,
    TEAM_KEY_OVERALL,
    NAME_TEAM,
    POSITION_OVERALL,
    STARTINGPOSITION_OVERALL,
    PLAYED_OVERALL,
    WON_OVERALL,
    DRAWN_OVERALL,
    LOST_OVERALL,
    GOALSFOR_OVERALL,
    GOALSAGAINST_OVERALL,
    POINTS_OVERALL
FROM DATA_2012

UNION ALL

SELECT
    2013,
    ID_TEAM,
    TEAM_KEY_OVERALL,
    NAME_TEAM,
    POSITION_OVERALL,
    STARTINGPOSITION_OVERALL,
    PLAYED_OVERALL,
    WON_OVERALL,
    DRAWN_OVERALL,
    LOST_OVERALL,
    GOALSFOR_OVERALL,
    GOALSAGAINST_OVERALL,
    POINTS_OVERALL
FROM DATA_2013

UNION ALL

SELECT
    2014,
    ID_TEAM,
    TEAM_KEY_OVERALL,
    NAME_TEAM,
    POSITION_OVERALL,
    STARTINGPOSITION_OVERALL,
    PLAYED_OVERALL,
    WON_OVERALL,
    DRAWN_OVERALL,
    LOST_OVERALL,
    GOALSFOR_OVERALL,
    GOALSAGAINST_OVERALL,
    POINTS_OVERALL
FROM DATA_2014

UNION ALL

SELECT
    2015,
    ID_TEAM,
    TEAM_KEY_OVERALL,
    NAME_TEAM,
    POSITION_OVERALL,
    STARTINGPOSITION_OVERALL,
    PLAYED_OVERALL,
    WON_OVERALL,
    DRAWN_OVERALL,
    LOST_OVERALL,
    GOALSFOR_OVERALL,
    GOALSAGAINST_OVERALL,
    POINTS_OVERALL
FROM DATA_2015

UNION ALL

SELECT
    2016,
    ID_TEAM,
    TEAM_KEY_OVERALL,
    NAME_TEAM,
    POSITION_OVERALL,
    STARTINGPOSITION_OVERALL,
    PLAYED_OVERALL,
    WON_OVERALL,
    DRAWN_OVERALL,
    LOST_OVERALL,
    GOALSFOR_OVERALL,
    GOALSAGAINST_OVERALL,
    POINTS_OVERALL
FROM DATA_2016

UNION ALL

SELECT
    2017,
    ID_TEAM,
    TEAM_KEY_OVERALL,
    NAME_TEAM,
    POSITION_OVERALL,
    STARTINGPOSITION_OVERALL,
    PLAYED_OVERALL,
    WON_OVERALL,
    DRAWN_OVERALL,
    LOST_OVERALL,
    GOALSFOR_OVERALL,
    GOALSAGAINST_OVERALL,
    POINTS_OVERALL
FROM DATA_2017

UNION ALL

SELECT
    2018,
    ID_TEAM,
    TEAM_KEY_OVERALL,
    NAME_TEAM,
    POSITION_OVERALL,
    STARTINGPOSITION_OVERALL,
    PLAYED_OVERALL,
    WON_OVERALL,
    DRAWN_OVERALL,
    LOST_OVERALL,
    GOALSFOR_OVERALL,
    GOALSAGAINST_OVERALL,
    POINTS_OVERALL
FROM DATA_2018

UNION ALL

SELECT
    2019,
    ID_TEAM,
    TEAM_KEY_OVERALL,
    NAME_TEAM,
    POSITION_OVERALL,
    STARTINGPOSITION_OVERALL,
    PLAYED_OVERALL,
    WON_OVERALL,
    DRAWN_OVERALL,
    LOST_OVERALL,
    GOALSFOR_OVERALL,
    GOALSAGAINST_OVERALL,
    POINTS_OVERALL
FROM DATA_2019

UNION ALL

SELECT
    2020,
    ID_TEAM,
    TEAM_KEY_OVERALL,
    NAME_TEAM,
    POSITION_OVERALL,
    STARTINGPOSITION_OVERALL,
    PLAYED_OVERALL,
    WON_OVERALL,
    DRAWN_OVERALL,
    LOST_OVERALL,
    GOALSFOR_OVERALL,
    GOALSAGAINST_OVERALL,
    POINTS_OVERALL
FROM DATA_2020

UNION ALL

SELECT
    2021,
    ID_TEAM,
    TEAM_KEY_OVERALL,
    NAME_TEAM,
    POSITION_OVERALL,
    STARTINGPOSITION_OVERALL,
    PLAYED_OVERALL,
    WON_OVERALL,
    DRAWN_OVERALL,
    LOST_OVERALL,
    GOALSFOR_OVERALL,
    GOALSAGAINST_OVERALL,
    POINTS_OVERALL
FROM DATA_2021

UNION ALL

SELECT
    2022,
    ID_TEAM,
    TEAM_KEY_OVERALL,
    NAME_TEAM,
    POSITION_OVERALL,
    STARTINGPOSITION_OVERALL,
    PLAYED_OVERALL,
    WON_OVERALL,
    DRAWN_OVERALL,
    LOST_OVERALL,
    GOALSFOR_OVERALL,
    GOALSAGAINST_OVERALL,
    POINTS_OVERALL
FROM DATA_2022

UNION ALL

SELECT
    2023,
    ID_TEAM,
    TEAM_KEY_OVERALL,
    NAME_TEAM,
    POSITION_OVERALL,
    STARTINGPOSITION_OVERALL,
    PLAYED_OVERALL,
    WON_OVERALL,
    DRAWN_OVERALL,
    LOST_OVERALL,
    GOALSFOR_OVERALL,
    GOALSAGAINST_OVERALL,
    POINTS_OVERALL
FROM DATA_2023

UNION ALL

SELECT
    2024,
    ID_TEAM,
    TEAM_KEY_OVERALL,
    NAME_TEAM,
    POSITION_OVERALL,
    STARTINGPOSITION_OVERALL,
    PLAYED_OVERALL,
    WON_OVERALL,
    DRAWN_OVERALL,
    LOST_OVERALL,
    GOALSFOR_OVERALL,
    GOALSAGAINST_OVERALL,
    POINTS_OVERALL
FROM DATA_2024

UNION ALL

SELECT
    2025,
    ID_TEAM,
    TEAM_KEY_OVERALL,
    NAME_TEAM,
    POSITION_OVERALL,
    STARTINGPOSITION_OVERALL,
    PLAYED_OVERALL,
    WON_OVERALL,
    DRAWN_OVERALL,
    LOST_OVERALL,
    GOALSFOR_OVERALL,
    GOALSAGAINST_OVERALL,
    POINTS_OVERALL
FROM DATA_2025;'''

print(sql)
con.cursor().execute(sql)
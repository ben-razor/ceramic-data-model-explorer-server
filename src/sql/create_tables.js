const createTableSQL = {
    create_ratings_sql: `
        CREATE TABLE IF NOT EXISTS ratings (
            ratings_id integer PRIMARY KEY AUTOINCREMENT,
            userid text NOT NULL, 
            modelid text, 
            rating int,
            comment text,
            UNIQUE (userid, modelid)
        )
    `,
    create_models_sql: `
        CREATE TABLE IF NOT EXISTS models (
            modelid text NOT NULL PRIMARY KEY,
            version text,
            author text,
            keywords text,
            readme text,
            package_json text
        )
    `,
    create_schemas_sql: `
        CREATE TABLE IF NOT EXISTS schemas (
            schema_path text NOT NULL PRIMARY KEY,
            modelid text NOT NULL,
            schema_name text,
            schema_json text
        )
    `,
    create_stats_sql: `
        CREATE TABLE IF NOT EXISTS stats (
            modelid text NOT NULL PRIMARY KEY,
            monthly_downloads int,
            npm_score real,
            npm_quality real,
            num_streams int,
            last_updated text
        )
    `,
    create_user_models_sql: `
        CREATE TABLE IF NOT EXISTS user_models (
            modelid text NOT NULL PRIMARY KEY,
            userid text NOT NULL,
            npm_package text NOT NULL,
            repo_url text NOT NULL,
            status text NOT NULL,
            last_updated text
        )
    `,
    create_applications_sql: `
        CREATE TABLE IF NOT EXISTS applications (
            application_id integer PRIMARY KEY AUTOINCREMENT,
            name text NOT NULL,
            image_url text,
            description text NOT NULL,
            userid text NOT NULL,
            app_url text,
            last_updated text
        )
    `,
    create_application_models_sql: `
        CREATE TABLE IF NOT EXISTS application_models (
            application_models_id integer PRIMARY KEY AUTOINCREMENT,
            application_id integer,
            modelid text
        )
    `,
    recreate_ratings_sql: `
        DROP TABLE IF EXISTS ratings
    `,
    recreate_applications_sql: `
        DROP TABLE IF EXISTS applications;
    `,
    recreate_application_models_sql: `
        DROP TABLE IF EXISTS application_models;
    `
}

export default createTableSQL;
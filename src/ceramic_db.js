import { application } from "express";
import createTableSQL from "./sql/create_tables.js";

class CeramicDB {
    constructor(db) {
        this.db = db;

        let tx = db.transaction(() => {
            db.prepare(createTableSQL.create_ratings_sql).run();
            db.prepare(createTableSQL.create_models_sql).run();
            db.prepare(createTableSQL.create_schemas_sql).run();
            db.prepare(createTableSQL.create_stats_sql).run();
            db.prepare(createTableSQL.create_user_models_sql).run();
            // db.prepare(createTableSQL.recreate_applications_sql).run();
            // db.prepare(createTableSQL.recreate_application_models_sql).run();
            db.prepare(createTableSQL.create_applications_sql).run();
            db.prepare(createTableSQL.create_application_models_sql).run();
        });

        tx();
    }

    rate(userid, modelid, rating, comment, cb) {
        let q = `
            INSERT OR REPLACE INTO ratings(userid, modelid, rating, comment)
            VALUES (?, ?, ?, ?)
        `;

        try {
            this.db.prepare(q).run([userid, modelid, rating, comment]);
            cb('', '');
        }
        catch(err) {
            cb(err)
        }
   }

    getRatings(cb) {
        let q = `
            SELECT modelid, SUM(rating) AS total 
            FROM ratings
            GROUP BY modelid
        `;

        try {
            let rows = this.db.prepare(q).all();
            cb('', rows);
        }
        catch(err) {
            cb(err)
        }
    }

    getUserRatings(userid, cb) {
        let q = `
            SELECT userid, modelid, rating, comment FROM ratings WHERE userid = ?
        `;

        try {
            let rows = this.db.prepare(q).all([userid]);
            cb('', rows);
        }
        catch(err) {
            cb(err);
        }
    }

    addModel(modelid, version, author, keywords, readme, package_json, schemas, user_model_info, cb) {
        let q = `
            INSERT OR REPLACE INTO models(modelid, version, author, keywords, readme, package_json) 
            VALUES (?, ?, ?, ?, ?, ?)
        `

        let values = [modelid, version, author, keywords, readme, JSON.stringify(package_json)]

        try {
            let tx = this.db.transaction(() => {
                this.db.prepare(q).run(values);

                let qSchemas = `
                    INSERT OR REPLACE INTO schemas(schema_path, modelid, schema_name, schema_json)
                    VALUES (?, ?, ?, ?)
                `

                let schema_tuples = [];
                for(let schema of schemas) {
                    schema_tuples.push(
                        [schema['path'], modelid, schema['name'], JSON.stringify(schema['schema_json'])]
                    )
                }

                this.db.prepare(qSchemas).run(schema_tuples.flat());

                if(user_model_info) {
                    let qUserModels = `
                        INSERT OR REPLACE INTO user_models(modelid, userid, npm_package, repo_url, status, last_updated)
                        VALUES (?, ?, ?, ?, ?, datetime('now'))
                    `

                    let valuesUserModel = [modelid, user_model_info['userid'], user_model_info['npm_package'], 
                            user_model_info['repo_url'], user_model_info['status']]
                    
                    this.db.prepare(qUserModels).run(valuesUserModel);
                }

                cb('', modelid);
            });
            
            tx();
        }
        catch(err) {
            cb(err)
        }
    }

    getModels(cb) {
        let q = `
                SELECT modelid, version, author, keywords, readme, package_json 
                FROM models
            `;

        try {
            let rows = this.db.prepare(q).all();
            cb('', rows);
        }
        catch(err) {
            cb(err)
        }
    }

    searchModels(search, cb) {
        let like  = `%${search}%`;

        let q = `
            SELECT models.modelid, version, author, keywords, readme, monthly_downloads, npm_score, package_json
            FROM models, schemas, stats
            WHERE (models.modelid = schemas.modelid AND models.modelid = stats.modelid and stats.modelid = schemas.modelid)
            AND models.modelid LIKE ? OR schemas.schema_json LIKE ? OR keywords LIKE ? OR author LIKE ? or readme LIKE ?
            GROUP BY models.modelid
        `;

        try {
            let rows = this.db.prepare(q).all([like, like, like, like, like]);
            cb('', rows);
        }
        catch(err) {
            cb(err)
        }
    }

    getModel(modelid, cb) {
        let q = `
            SELECT models.modelid, version, author, keywords, readme, package_json, schema_path, schema_name, schema_json
            FROM models, schemas
            WHERE models.modelid = schemas.modelid
            AND models.modelid = ?
        `;

        try {
            let rows = this.db.prepare(q).all([modelid]);
            cb('', rows)
        }
        catch(err) {
            cb(err)
        }
    }

    getStats(modelid, cb) {
        let q = `
            SELECT modelid, monthly_downloads, npm_score, npm_quality, num_streams
            FROM stats 
            WHERE modelid = ?
        `;

        try {
            let row = this.db.prepare(q).get([modelid]);
            cb('', row);
        }
        catch(err) {
            cb(err);
        }
    }

    getAllStats(cb) {
        let q = `
            SELECT modelid, monthly_downloads, npm_score, npm_quality, num_streams
            FROM stats 
        `;

        try {
            let rows = this.db.prepare(q).all();
            cb('', rows)
        }
        catch(err) {
            cb(err)
        }
    }

    addStats(modelid, monthly_downloads, npm_score, npm_quality, num_streams, cb) {
        let q = `
            INSERT OR REPLACE INTO stats(modelid, monthly_downloads, npm_score, npm_quality, num_streams, last_updated)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
        `;

        try {
            this.db.prepare(q).run([modelid, monthly_downloads, npm_score, npm_quality, num_streams]);
            cb();
        }
        catch(err) {
            cb(err)
        }
    }

    getUserModels(userid, cb) {
        try {
            let rows;
            if(userid) {
                let q = `
                    SELECT modelid, userid, npm_package, repo_url, status, last_updated
                    FROM user_models
                    WHERE userid = ?
                `;
                rows = this.db.prepare(q).all([userid]);
            }
            else {
                let q = `
                    SELECT modelid, userid, npm_package, repo_url, status, last_updated
                    FROM user_models
                `;
                rows = this.db.prepare(q).all();
            }
            cb('', rows);
        }
        catch(err) {
            cb(err)
        }
    }

    getApplications(cb) {
        let q = `
            SELECT applications.application_id, name, image_url, description, userid, app_url, last_updated, modelid
            FROM applications, application_models
            WHERE applications.application_id = application_models.application_id
        `;

        try {
            let rows = this.db.prepare(q).all();

            // Convert modelids from rows into array with single application record
            let modelListRows = {};
            for(let row of rows) {
                let _row = { ...row };
                let appId = _row.application_id;
                let modelId = _row.modelid;

                if(appId in modelListRows) {
                    modelListRows[appId].modelid.push(modelId);
                }
                else {
                    modelListRows[appId] = _row;
                    modelListRows[appId].modelid = [modelId];
                }
            }
            rows = Object.values(modelListRows);
            cb('', rows);
        }
        catch(err) {
            cb(err)
        }
    }

    addApplication(name, image_url, description, userid, app_url, data_model_ids, cb) {
        let q = `
            INSERT INTO applications(name, image_url, description, userid, app_url, last_updated) 
            VALUES (?, ?, ?, ?, ?, datetime('now'))
        `

        try {
            let tx = this.db.transaction(() => {
                let info = this.db.prepare(q).run([name, image_url, description, userid, app_url]);

                let applicationId = info.lastInsertRowid;

                let q2 = `
                    INSERT INTO application_models(application_id, modelid)
                    VALUES (?, ?)
                `

                let appModels = [];
                for(let modelId of data_model_ids) {
                    appModels = appModels.concat( [applicationId, modelId] )
                }

                this.db.prepare(q2).run(appModels);
                cb();
            });
            tx();
        }
        catch(err) {
            cb(err)
        }
    }
}



export default CeramicDB;
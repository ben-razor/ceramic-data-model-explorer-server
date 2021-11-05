import { application } from "express";
import createTableSQL from "./sql/create_tables.js";

class CeramicDB {
    constructor(db) {
        this.db = db;
        return;
        db.serialize(() => {
            db.run(createTableSQL.create_ratings_sql)
            db.run(createTableSQL.create_models_sql)
            db.run(createTableSQL.create_schemas_sql)
            db.run(createTableSQL.create_stats_sql)
            db.run(createTableSQL.create_user_models_sql)
            // db.run(createTableSQL.recreate_applications_sql)
            // db.run(createTableSQL.recreate_application_models_sql)
            db.run(createTableSQL.create_applications_sql)
            db.run(createTableSQL.create_application_models_sql)
        });
    }

    rate(userid, modelid, rating, comment, cb) {
        this.db.serialize(() => {
            let q = `
                INSERT OR REPLACE INTO ratings(userid, modelid, rating, comment)
                VALUES (?, ?, ?, ?)
            `;

            this.db.run(q, [userid, modelid, rating, comment], cb);
        })
   }

    getRatings(cb) {
        this.db.serialize(() => {
            let q = `
                SELECT modelid, SUM(rating) AS total 
                FROM ratings
                GROUP BY modelid
            `;

            this.db.all(q, (err, rows) => { 
                cb(err, rows);
            });
        })
    }

    getUserRatings(userid, cb) {
        this.db.serialize(() => {
            let q = `
                SELECT userid, modelid, rating, comment FROM ratings WHERE userid = ?
            `;

            this.db.all(q, [userid], (err, rows) => { 
                cb(err, rows);
            });
        })
    }

    addModel(modelid, version, author, keywords, readme, package_json, schemas, user_model_info, cb) {
        this.db.serialize(() => {
            let q = `
                INSERT OR REPLACE INTO models(modelid, version, author, keywords, readme, package_json) 
                VALUES (?, ?, ?, ?, ?, ?)
            `

            let values = [modelid, version, author, keywords, readme, JSON.stringify(package_json)]

            this.db.run(q, values, (err) => {
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

                this.db.run(qSchemas, schema_tuples.flat(), (schemasErr) => {
                    if(user_model_info) {
                        let qUserModels = `
                            INSERT OR REPLACE INTO user_models(modelid, userid, npm_package, repo_url, status, last_updated)
                            VALUES (?, ?, ?, ?, ?, datetime('now'))
                        `

                        let valuesUserModel = [modelid, user_model_info['userid'], user_model_info['npm_package'], 
                                user_model_info['repo_url'], user_model_info['status']]
                        
                        this.db.run(qUserModels, valuesUserModel, (userModelsErr) => {
                            console.log('User model added: ', valuesUserModel);
                            cb(userModelsErr, modelid);
                        })
                    }
                    else {
                        cb(schemasErr, modelid)
                    }
                })
            })
        });
    }

    getModels(cb) {
        this.db.serialize(() => {
            let q = `
                    SELECT modelid, version, author, keywords, readme, package_json 
                    FROM models
                `;

                this.db.all(q, (err, rows) => { 
                    cb(err, rows);
                });
        })
    }

    searchModels(search, cb) {
        this.db.serialize(() => {
            let like  = `%${search}%`;

            let q = `
                SELECT models.modelid, version, author, keywords, readme, monthly_downloads, npm_score, package_json
                FROM models, schemas, stats
                WHERE (models.modelid = schemas.modelid AND models.modelid = stats.modelid and stats.modelid = schemas.modelid)
                AND models.modelid LIKE ? OR schemas.schema_json LIKE ? OR keywords LIKE ? OR author LIKE ? or readme LIKE ?
                GROUP BY models.modelid
            `;

            this.db.all(q, [like, like, like, like, like], (err, rows) => {
                cb(err, rows);
            });
        });
    }

    getModel(modelid, cb) {
        this.db.serialize(() => {
            let q = `
                SELECT models.modelid, version, author, keywords, readme, package_json, schema_path, schema_name, schema_json
                FROM models, schemas
                WHERE models.modelid = schemas.modelid
                AND models.modelid = ?
            `;

            this.db.all(q, [modelid], (err, rows) => cb(err, rows))
        });
    }

    getStats(modelid, cb) {
        this.db.serialize(() => {
            let q = `
                SELECT modelid, monthly_downloads, npm_score, npm_quality, num_streams
                FROM stats 
                WHERE modelid = ?
            `;

            this.db.get(q, [modelid], (err, rows) => cb(err, rows))
        });
    }

    getAllStats(cb) {
        this.db.serialize(() => {
            let q = `
                SELECT modelid, monthly_downloads, npm_score, npm_quality, num_streams
                FROM stats 
            `;

            this.db.all(q, (err, rows) => cb(err, rows))
        });
    }

    addStats(modelid, monthly_downloads, npm_score, npm_quality, num_streams, cb) {
        this.db.serialize(() => {
            let q = `
                INSERT OR REPLACE INTO stats(modelid, monthly_downloads, npm_score, npm_quality, num_streams, last_updated)
                VALUES (?, ?, ?, ?, ?, datetime('now'))
            `;

            this.db.run(q, [modelid, monthly_downloads, npm_score, npm_quality, num_streams], cb);
        });
    }

    getUserModels(userid, cb) {
        this.db.serialize(() => {
            if(userid) {
                let q = `
                    SELECT modelid, userid, npm_package, repo_url, status, last_updated
                    FROM user_models
                    WHERE userid = ?
                `;
                this.db.all(q, [userid], (err, rows) => cb(err, rows));
            }
            else {
                let q = `
                    SELECT modelid, userid, npm_package, repo_url, status, last_updated
                    FROM user_models
                `;
                this.db.all(q, (err, rows) => cb(err, rows));
            }
        });
    }

    getApplications(cb) {
        this.db.serialize(() => {
            let q = `
                SELECT applications.application_id, name, image_url, description, userid, app_url, last_updated, modelid
                FROM applications, application_models
                WHERE applications.application_id = application_models.application_id
            `;
            this.db.all(q, (err, rows) => {
                // Convert modelids from rows into array with single application record
                let modelListRows = {};
                if(!err) {
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
                }
                cb(err, rows);
            });
        });
    }

    addApplication(name, image_url, description, userid, app_url, data_model_ids, cb) {
        this.db.serialize(() => {
            let q = `
                INSERT INTO applications(name, image_url, description, userid, app_url, last_updated) 
                VALUES (?, ?, ?, ?, ?, datetime('now'))
            `

            let db = this.db;

            this.db.run(q, [name, image_url, description, userid, app_url], function(err) {
                if(!err) {
                    let applicationId = this.lastID;
                    console.log('inserted application: ', applicationId);

                    let q2 = `
                        INSERT INTO application_models(application_id, modelid)
                        VALUES (?, ?)
                    `

                    let appModels = [];
                    for(let modelId of data_model_ids) {
                        appModels = appModels.concat( [applicationId, modelId] )
                    }

                    db.run(q2, appModels, cb);
                }
            });
        });
    }
}



export default CeramicDB;
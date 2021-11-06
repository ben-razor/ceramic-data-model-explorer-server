import dotenv from 'dotenv';
import express from 'express';
import https from 'https';
import fs from 'fs';
import cors from 'cors';
import DidVerifier from './did_verifier.js';
import CeramicDB from './ceramic_db.js';
import ApiNPM from '../lib/ApiNPM.js';
import sqlite3 from 'better-sqlite3';
import { URL } from 'url';

import GithubModelHelpers from "../lib/GithubModelHelpers.js";

let nodeEnv = process.env.NODE_ENV;
let envPath =  '.env' + (nodeEnv ? `.${nodeEnv}` : '');
console.log('node env', envPath);
dotenv.config({ path: envPath });

const app = express()
const port = process.env.PORT || 8878;
let options = {};
const key = process.env.KEY || 'src/localhost.key';
const cert = process.env.CERT || 'src/localhost.crt';

if(key && cert) {
    options = {
        key: fs.readFileSync(key),
        cert: fs.readFileSync(cert)
    };
}

app.use(express.json());

var corsOptionsDelegate = function (req, callback) {
    let allowList= ['https://ceramic-explore-ben-razor.vercel.app', 'https://ceramic-explore.vercel.app', 'https://34.77.88.57']
    let host = req.hostname;

    if(host.includes('localhost')) {
        allowList = ['http://localhost', 'https://localhost'];
    }

    let origin = req.header('Origin');
    let corsOptions;

    if(origin) {
        let originNoPort = origin.split(':').slice(0,2).join(':')

        if (allowList.includes(originNoPort )) {
            corsOptions = { origin: true } // reflect (enable) the requested origin in the CORS response
        } else {
            corsOptions = { origin: false } // disable CORS for this request
        }
    }
    else {
        corsOptions = { origin: true };
    }
    callback(null, corsOptions) // callback expects two parameters: error and options
}

app.use(cors(corsOptionsDelegate));

const __dirname = new URL('.', import.meta.url).pathname;
let dbFile = process.env.DB_FILE || __dirname + 'db/ceramic_models.db';
console.log('dbFile', dbFile);
let db = new sqlite3(dbFile);
let cdb = new CeramicDB(db);

const testDid = 'did:3:kjzl6cwe1jw146h55xwym8jxgbn1rd86k2km1p5q06u19wa3y5ob9948k9pq22n';
const jwsJson = `
{"payload":"eyJoZWxsbyI6IndvcmxkIn0","signatures":[{"protected":"eyJraWQiOiJkaWQ6MzpranpsNmN3ZTFqdzE0Nmg1NXh3eW04anhnYm4xcmQ4Nmsya20xcDVxMDZ1MTl3YTN5NW9iOTk0OGs5cHEyMm4_dmVyc2lvbi1pZD0wI1p5VnVaM1pzaGhiWTVKVSIsImFsZyI6IkVTMjU2SyJ9","signature":"6xDEp_x7WLCsSp7NvWJBCxXpDRbYZMlGpWRZgyQaY05ki1NqZWy9yWbdj4oAITck2OOWviIACq-rC2VQe8s2hw"}]}
`;

let API_URL = process.env.CERAMIC_URL || 'https://ceramic-clay.3boxlabs.com';
console.log('API_URL', API_URL);
const didVerifier = new DidVerifier(API_URL);

const verify = () => {
    return async function (req, res, next) {
        let body = req.body;
        let userIdSupplied = ('userid' in body);
        let jwsSupplied = ('jws' in body);

        if(jwsSupplied && userIdSupplied) {
            let userid = body.userid;
            let result = await didVerifier.verifyJWS(userid, body.jws);

            if(result.success) {
                next()
            }
            else {
                let resp = {
                    success: false,
                    reason: result.reason,
                    data: {}
                }

                let status = 500;

                if(resp.reason === 'error-jws-mismatch') {
                    status = 401;
                }

                res.status(status).send(resp)
            }
        }
        else {
            let reason = 'error-empty-userid';

            if(userIdSupplied) {
                reason = 'error-empty-jws';
            }

            let resp = {
                success: false,
                reason: reason,
                data: {}
            }

            res.status(400).send(resp)
        }
    }
}

function handleDBResult(err, rows) {
    let status = 200;
    let success = true;
    let reason = 'ok';
    let data = [];

    if(!err) {
        data = rows;
    }
    else {
        status = 500;
        success = false;
        reason = 'error-db:' + err.toString();
        console.log(err);
    }

    let resp = {
        success: success,
        reason: reason,
        data: data
    }

    return [ status, resp ];
}

function getErrorResponse(status, reason, data={}) {
    let resp = {
        success: false,
        reason: reason,
        data: data
    }

    return [status, resp];
}

function getSuccessResponse(data) {
    let status = 200;
    let resp = {
        success: true,
        reason: 'ok',
        data: data
    }
    return [status, resp];
}

app.get('/', async (req, res) => {
    res.send('Johnny 5 is alive!');
});

app.get('/api/get_model_ratings', async(req, res) => {
    let status = 200;
    let success = true;
    let reason = 'ok';
    let userid = req.query.userid;
    
    cdb.getRatings((err, rows) => {
        let data = [];

        if(!err) {
            data = rows;
        }
        else {
            status = 500;
            success = false;
            reason = 'error-db:' + err.toString();
            console.log(err);
        }

        let resp = {
            success: success,
            reason: reason,
            data: data
        }

        res.status(status).json(resp);
    });
});

app.get('/api/get_models', async(req, res) => {
    let status = 200;
    let success = true;
    let reason = 'ok';
    
    cdb.getModels((err, rows) => {
        let data = [];

        if(!err) {
            data = rows;
        }
        else {
            status = 500;
            success = false;
            reason = 'error-db:' + err.toString();
            console.log(err);
        }

        let resp = {
            success: success,
            reason: reason,
            data: data
        }

        res.status(status).json(resp);
    });
});

app.post('/api/update_models', async(req, res) => {
    try {
        cdb.getModels((err, rows) => {
            let existingModelIds = [];

            if(!err) {
                for(let row of rows) {
                    existingModelIds.push(row.modelid);
                }

                (async() => {
                    let newModelInfos = await GithubModelHelpers.get_model_infos(existingModelIds);
                    console.log('NMI', existingModelIds, newModelInfos);
                    let addedModels = [];
                    let failedModels = [];

                    for(let modelInfo of newModelInfos) {
                        console.log('MODEL INFO', modelInfo)
                        let packageJSON = modelInfo.package_json;

                        cdb.addModel(
                            modelInfo.model_id,
                            packageJSON.version,
                            packageJSON.author,
                            packageJSON.keywords.join(','),
                            modelInfo.readme_md,
                            packageJSON,
                            modelInfo.schemas,
                            null,
                            (err, addingModelID) => {
                                if(err) {
                                    console.log(`Error adding model ${addedModelID}`)
                                    failedModels.push(addingModelID);

                                    if(addedModels.length + failedModels.length === newModelInfos.length) {
                                        let [status, resp] = getErrorResponse(500, 'error-db-error:' + err.toString());
                                        res.status(status).json(resp);
                                    }
                                }
                                else {
                                    console.log(`Model ${addingModelID} added`)
                                    addedModels.push(addingModelID);

                                    if(addedModels.length + failedModels.length === newModelInfos.length) {
                                        let [status, resp] = getSuccessResponse({
                                            'addedModels': addedModels,
                                            'failedModels': failedModels
                                        })
                                        res.status(status).json(resp);
                                    }
                                }

                            }
                        )
                    }
                })();
            }
            else {
                let [status, resp] = getErrorResponse(500, 'error-db-error:' + err.toString());
                res.status(status).json(resp);
            }
        });
    }
    catch(e) {
        let [status, resp] = getErrorResponse(500, 'error-db-error:' + e.toString());
        res.status(status).json(resp);
        console.log(e);
    }
});

app.get('/api/rate', async(req, res) => {
    let status = 200;
    let success = true;
    let reason = 'ok';
    let userIdSupplied = ('userid' in req.query);
    
    if(userIdSupplied) {
        let userid = req.query.userid;
        cdb.getUserRatings(userid, (err, rows) => {
            let data = [];

            if(!err) {
                data = rows;
            }
            else {
                status = 500;
                success = false;
                reason = 'error-db:' + err.toString();
                console.log(err);
            }

            let resp = {
                success: success,
                reason: reason,
                data: data
            }

            res.status(status).json(resp);
        });
    }
    else {
        status = 400;

        let resp = {
            success: false,
            reason: 'error-empty-userid',
            data: {}
        }
        res.status(status).json(resp);
    }
})

app.post('/api/rate', verify(), async(req, res) => {
    let status = 200;
    let success = true;
    let reason = 'ok';
    let resp = {};
    let body = req.body
    let userIdSupplied = ('userid' in body);
    let modelIdSupplied = ('modelid' in body);
    let ratingSupplied = ('rating' in body);
    let ratingValid = true;
    let rating = 0;

    if(ratingSupplied) {
        let suppliedRating = parseInt(body.rating);
        if(suppliedRating === 10 || suppliedRating === 0) {
            rating = suppliedRating;
        }
        else {
            ratingValid = false;
        }
    }
    
    if(userIdSupplied && modelIdSupplied && ratingSupplied && ratingValid) {
        let userid = body.userid.trim();
        let modelid = body.modelid.trim();
        let comment = body.comment ? body.comment.trim() : '';

        cdb.rate(userid, modelid, rating, comment, (rateErr) => {
            if(!rateErr) {
                cdb.getUserRatings(userid, (err, rows) => {
                    let data = [];

                    if(!err) {
                        data = rows;
                    }
                    else {
                        status = 500;
                        success = false;
                        reason = 'error-db:' + err.toString();
                        console.log(err);
                    }

                    resp = {
                        success: success,
                        reason: reason,
                        data: data
                    }

                    res.status(status).json(resp);
                });
            }
            else {
                status = 400;

                resp = {
                    success: false,
                    reason: 'error-db:' + err.toString(),
                    data: {}
                }

                res.status(status).json(resp);
            }
        });
    }
    else {
        if(!userIdSupplied) {
            reason = 'error-empty-userid';
        }
        else if(!modelIdSupplied) {
            reason = 'error-empty-modelid';
        }
        else if(!ratingSupplied) {
            reason = 'error-empty-rating';
        }
        else if(!ratingValid) {
            reason = 'error-invalid-rating';
        }

        status = 400;

        let resp = {
            success: false,
            reason: reason,
            data: {}
        }
        res.status(status).json(resp);
    }
})

app.get('/api/search_models', async(req, res) => {
    let status = 200;
    let success = true;
    let reason = 'ok';
    let resp = {};
    let search = req.query.search || '';
    
    try {
        cdb.searchModels(search, (err, rows) => {
            let data = [];

            if(!err) {
                data = rows;
            }
            else {
                status = 500;
                success = false;
                reason = 'error-db:' + err.toString();
                console.log(err);
            }

            let resp = {
                success: success,
                reason: reason,
                data: data
            }

            res.status(status).json(resp);
        });
    }
    catch(e) {
        let [status, resp] = getErrorResponse(500, 'error-db-error');
        res.status(status).json(resp);
    }
});

app.get('/api/get_model', async(req, res) => {
    let modelIdSupplied = ('modelid' in req.query);

    if(modelIdSupplied) {
        try {
            cdb.getModel(req.query.modelid, (err, rows) => {
                let [status, resp] = handleDBResult(err, rows);
                res.status(status).json(resp);
            });
        }
        catch(e) {
            let [status, resp] = getErrorResponse(500, 'error-db-error');
            res.status(status).json(resp);
            console.log(e);
        }
    }
    else {
        let [status, resp] = getErrorResponse(400, 'error-empty-modelid');
        res.status(status).json(resp);
    }
});

app.get('/api/stats', async(req, res) => {
    let modelIdSupplied = ('modelid' in req.query);

    try {
        if(modelIdSupplied) {
            cdb.getStats(req.query.modelid, (err, rows) => {
                let [status, resp] = handleDBResult(err, rows);
                res.status(status).json(resp);
            });
        }
        else {
            cdb.getAllStats((err, rows) => {
                let [status, resp] = handleDBResult(err, rows);
                res.status(status).json(resp);
            });
        }
    }
    catch(e) {
        let [status, resp] = getErrorResponse(500, 'error-db-error');
        res.status(status).json(resp);
        console.log(e);
    }
});

app.post('/api/stats', async(req, res) => {
    let body = req.body;
    let modelIdSupplied = 'modelid' in body;
    let packageIdSupplied = 'packageid' in body;
    let reason = 'ok';

    if(modelIdSupplied && packageIdSupplied) {
        let modelid = body.modelid.trim()
        let packageid = body.packageid.trim()

        let apiNPM = new ApiNPM()

        let monthly_downloads = 0;
        let npm_score = 0;
        let npm_detail = {};
        let npm_quality = 0;
        let num_streams = 0;

        try {
            let download_info = apiNPM.getDownloads(packageid);
            monthly_downloads = download_info.downloads || 0;
        }
        catch(e) {
            console.log('Could not retrieve num downloads: ' + e.toString())
        }

        try {
            let score_info = apiNPM.getRegistryScore(packageid)
            npm_score = score_info.final || 0;
            npm_detail = score_info.detail || {};
            npm_quality = npm_detail.quality || 0;
        }
        catch(e) {
            console.log('Could not retrieve registry score: ' + e.toString())
        }

        cdb.getStats(modelid, (err, row) => {
            if(!err && row) {
                monthly_downloads = monthly_downloads || row.monthly_downloads;
                npm_score = npm_score || row.npm_score;
                npm_quality = npm_quality || row.npm_quality;
            }

            console.log('adding stats: ', modelid, monthly_downloads, npm_score, npm_quality, num_streams);

            cdb.addStats(modelid, monthly_downloads, npm_score, npm_quality, num_streams, (addErr) => {
                if(!addErr) {
                    cdb.getStats(modelid, (newErr, newRows) => {
                        if(!newErr) {
                            let [status, resp] = getSuccessResponse(newRows);
                            res.status(status).json(resp);
                        }
                        else {
                            let [status, resp] = getErrorResponse(500, 'error-db-error:' + newErr.toString());
                            res.status(status).json(resp);
                        }
                    });
                }
                else {
                    let [status, resp] = getErrorResponse(500, 'error-db-error:' + addErr.toString());
                    res.status(status).json(resp);
                }
            })
        });
    }
    else {
        if(!modelIdSupplied) {
            reason = 'error-empty-modelid';
        }
        else if(!packageIdSupplied) {
            reason = 'error-empty-packageid';
        }

        let [status, resp] = getErrorResponse(400, reason);
        res.status(status).json(resp);
    }
});

app.get('/api/user_models', async(req, res) => {
    try {
        cdb.getUserModels(req.query.userid, (err, rows) => {
            let [status, resp] = handleDBResult(err, rows);
            res.status(status).json(resp);
        });
    }
    catch(e) {
        let [status, resp] = getErrorResponse(500, 'error-db-error');
        res.status(status).json(resp);
        console.log(e);
    }
});

app.post('/api/user_models', verify(), async(req, res) => {
    let body = req.body

    let modelIdSupplied = body.modelid;
    let userIdSupplied = body.userid;
    let packageIdSupplied = body.npmPackage;
    let repoURLSupplied = body.repoURL;

    let apiNPM = new ApiNPM();

    if(modelIdSupplied && userIdSupplied && packageIdSupplied && repoURLSupplied) {
        let modelid = body.modelid.trim();
        let userid = body.userid.trim();
        let packageId = body.npmPackage.trim();
        let repoURL = body.repoURL.trim();

        let repoParts = repoURL.replace('https://', '').split('/'); 

        if(repoParts.length < 7) {
            let [status, resp] = getErrorResponse(400, 'error-repo-url-invalid');
            res.status(status).json(resp);
            console.log(e);
        }
        else {
            let gh_user_id = repoParts[1]
            let gh_repo = repoParts[2]
            let gh_branch = repoParts[4]
            let gh_package = repoParts[6]

            let package_url = `https://raw.githubusercontent.com/${gh_user_id}/${gh_repo}/${gh_branch}/packages/${gh_package}/package.json`
            console.log('Getting package json from', package_url)

            let readme_url = `https://raw.githubusercontent.com/${gh_user_id}/${gh_repo}/${gh_branch}/packages/${gh_package}/README.md`
            console.log('Getting readme from', readme_url)

            console.log(`Attempting to get Github files for ${gh_user_id}, ${gh_repo}, ${gh_package}, ${gh_branch}`)
            let result = await GithubModelHelpers.get_model_info(gh_user_id, gh_repo, gh_package, gh_branch)

            if(result.success) {
                let model_info = result.data;

                let model_id = model_info['model_id'];
                let package_json = model_info['package_json'];
                let readme_md = model_info['readme_md'];
                let schemas = model_info['schemas'];

                let user_model_info = {
                    'userid': userid,
                    'npm_package': packageId,
                    'repo_url': repoURL,
                    'status': 'active'
                }

                try {
                    let data = {
                        'state': 'ADDING_MODEL',
                        'model_id': model_id,
                        'version': package_json['version'],
                        'author': package_json['author'],
                        'keywords': package_json['keywords'].join(','),
                        'readme_md': readme_md,
                        'package_json': package_json,
                        'schemas': schemas,
                        'user_model_info': user_model_info,
                    }

                    cdb.addModel(
                        model_id,
                        package_json['version'],
                        package_json['author'],
                        package_json['keywords'].join(','),
                        readme_md,
                        package_json,
                        schemas,
                        user_model_info,
                        (err) => {
                            let [status, resp] = getSuccessResponse(data);
                            res.status(status).json(resp);
                        }
                    )
                }
                catch(e) {
                    let [status, resp] = getErrorResponse(500, 'error-db-error');
                    res.status(status).json(resp);
                    console.log(e);
                }
            }
            else {
                let reason = 'error-fetching-files-from-github:' + result['reason']
                let [status, resp] = getErrorResponse(400, reason);
                res.status(status).json(resp);
            }
        }
    }
    else {
        if(!modelIdSupplied) {
            reason = 'error-empty-modelid';
        }
        else if(!userIdSupplied) {
            reason = 'error-empty-userid';
        }
        else if(!packageIdSupplied) {
            reason = 'error-empty-packageid';
        }
        else if(!repoURLSupplied) {
            reason = 'error-empty-repoURL';
        }

        let [status, resp] = getErrorResponse(400, reason);
        res.status(status).json(resp);
    }
});

app.get('/api/applications', async(req, res) => {
    try {
        cdb.getApplications((err, rows) => {
            let [status, resp] = handleDBResult(err, rows);
            res.status(status).json(resp);
        });
    }
    catch(e) {
        let [status, resp] = getErrorResponse(500, 'error-db-error');
        res.status(status).json(resp);
        console.log(e);
    }
});

app.post('/api/applications', verify(), async(req, res) => {
    let body = req.body

    let nameSupplied = body.name;
    let descriptionSupplied = body.description;
    let userIdSupplied = body.userid;
    let appURLSupplied = body.appURL;
    let dataModelIdsSupplied = body.dataModelIDs;
   
    if(nameSupplied && descriptionSupplied && userIdSupplied && appURLSupplied && dataModelIdsSupplied) {
        let userId = body.userid.trim();
        let name = body.name.trim()
        let imageURL = body.imageURL ? body.imageURL.trim() : '';
        let description = body.description.trim()
        let appURL = body.appURL.trim()
        let dataModelIdsCSV = body.dataModelIDs.trim()
        let dataModelIds = dataModelIdsCSV.split(',')

        cdb.addApplication(name, imageURL, description, userId, appURL, dataModelIds, (err) => {
            if(err) {
                let [status, resp] = getErrorResponse(500, 'error-db-error');
                res.status(status).json(resp);
                console.log(err);
            }
            else {
                let data = {'add app: ': [name, imageURL, description, userId, appURL, dataModelIds]}
                let [status, resp] = getSuccessResponse(data);
                res.status(status).json(resp);
            }
        });
    }
    else {
        if(!userIdSupplied) {
            reason = 'error-empty-userid';
        }
        else if(!nameSupplied) {
            reason = 'error-empty-name';
        }
        else if(!descriptionSupplied) {
            reason = 'error-empty-description';
        }
        else if(!appURLSupplied) {
            reason = 'error-empty-appURL';
        }
        else if(!dataModelIdsSupplied) {
            reason = 'error-empty-dataModelIDs';
        }

        let [status, resp] = getErrorResponse(400, reason);
        res.status(status).json(resp);
    }
})

https.createServer(options, app).listen(port, () => {
    console.log(`Ceramic data model app listening on ${port}`)
});
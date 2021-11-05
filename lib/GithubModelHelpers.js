import fetch from 'node-fetch'
import ApiGithub from './ApiGithub.js'

class GithubModelHelpers {

    static async get_model_info(user_id, repo_id, model_id, branch_id) {
        let success = true 
        let reason = ''
        let new_model_info = {}

        try {
            let apiGithub = new ApiGithub(user_id, repo_id)
            let tree = await apiGithub.lsTree(null, branch_id)

            let rawContentURL = await apiGithub.getRawContentURL(branch_id, `packages/${model_id}/package.json`)
            console.log('rcURL', rawContentURL);
            let r = await fetch(rawContentURL)
            let package_json = await r.json()

            let rawReadmeURL = await apiGithub.getRawContentURL(branch_id, `packages/${model_id}/README.md`)
            let r2 = await fetch(rawReadmeURL);
            let readme_md = await r2.text();

            let schemasFolderBase = `packages/${model_id}/schemas`
            let schemasFolder = tree.filter(x => x.path.startsWith(schemasFolderBase))
            console.log('Schemas folder: ', schemasFolder);

            let schemas = []
            for(let item of schemasFolder) {
                let schema_path = item['path']
                let schema_file = schema_path.replace(schemasFolderBase, '')
                console.log('Path: ', schema_path)
                
                if(schema_file) {
                    let rawSchemaURL = await apiGithub.getRawContentURL(branch_id, `${item["path"]}`)
                    console.log('rsu', rawSchemaURL)
                    let rSchema = await fetch(rawSchemaURL)
                    console.log('rsu got', rawSchemaURL)
                    let schema_json = await rSchema.json()
                    console.log('rsu json')
                    schemas.push({
                        'name': schema_file,
                        'path': schema_path,
                        'schema_json': schema_json 
                    })
                }
            }

            new_model_info = {
                'model_id': model_id,
                'package_json': package_json,
                'readme_md': readme_md,
                'schemas': schemas
            }
        }
        catch(e) {
            success = false;
            reason = e.toString();
            console.log(e);
        }

        return {
            'success': success,
            'reason': reason,
            'data': new_model_info
        }
    }

    /*
    Get the package.json, README.md and schemas from Github.

    param: existing_model_ids An array of model ids to ignore
    */
    static async get_model_infos(existing_model_ids=[], user_id='ceramicstudio', repo_id='datamodels') {

        let apiGithub = new ApiGithub(user_id, repo_id)

        let tree = await apiGithub.lsTree()
        let packagesFolder = tree.filter(x => x.path === 'packages')
        let packagesURL = packagesFolder[0]['url']

        console.log('packurl', packagesURL);
        let j = await apiGithub.get(packagesURL) 

        let dataModels = j['tree']

        let new_model_infos = []

        for(let model of dataModels) {
            let model_id = model['path']
            console.log('modelid', model_id);

            if(model_id in existing_model_ids) {
                continue;
            }

            let result = await GithubModelHelpers.get_model_info(user_id, repo_id, model_id, 'main')

            if(result['success']) {
                new_model_infos.push(result['data'])
            }
        }
       
        return new_model_infos
    }
}

export default GithubModelHelpers;
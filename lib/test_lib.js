import GithubModelHelpers from "./GithubModelHelpers.js";
import ApiNPM from "./ApiNPM.js";

// let res = await GithubModelHelpers.get_model_info('ceramicstudio', 'datamodels', '3id-keychain', 'main')

async function testGithubModelHelpers() {
    let res = await GithubModelHelpers.get_model_infos(['identity-accounts-crypto', 'identity-accounts-web', 'identity-profile-basic']);

    let modelInfo = res[0];

    console.log(modelInfo.model_id)
    console.log(modelInfo.package_json)
    console.log(modelInfo.readme_md)
    console.log(modelInfo.schemas[0])
    console.log(modelInfo.schemas[0].schema_json)
}

async function testApiNPM() {
    let apiNPM = new ApiNPM();

    let res = await apiNPM.getDownloads('@ben-razor/basic-skills');

    console.log(res);
}

await testApiNPM();
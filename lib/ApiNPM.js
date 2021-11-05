import fetch from 'node-fetch'

class ApiNPM {

    constructor() {
        this.host = 'https://registry.npmjs.cf';
        this.apiHost = 'https://api.npmjs.org';
        this.npmsHost = 'https://api.npms.io/v2';
    }

    async getRepoInfo(npmPackage) {
        npmPackage = encodeURIComponent(npmPackage);
        let r = await fetch(this.host + '/' + npmPackage)
        let j = await r.json();
        return j;
    }

    /**
     * 
     * Gets npm registry api score in format:
     * 
     * score: {
        detail: {
            maintenance: 0.33324616339425556
            popularity: 0.0050101899852684996
            quality: 0.40060513735475
        }
        final: 0.23857126488925962
    }
     * 
     * API is here:
     * 
     * https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md
     * 
     * @param {string} npmPackage 
     */
    async getRegistryScore(npmPackage) {
        npmPackage = encodeURIComponent(npmPackage);
        let url = `${this.host}/-/v1/search?text=${npmPackage}&size=10`
        let r = await fetch(url);
        let j = await r.json();

        let details = {};
        if(j && j.objects) {
            for(let o of j.objects) {
                if(o.package.name === npmPackage) {
                    details = o.score;
                    break;
                }
            }
        }

        return details;
    }

    /**
     * Get's download stats in format:
     * 
     * {"downloads":15,"start":"2021-09-20","end":"2021-10-19","package":"@datamodels/3id-keychain"}
     * 
     * @param {string} npmPackage 
     * @param {string} period (last-day|last-week|last-month)
     */
    async getDownloads(npmPackage, period='last-month') {
        npmPackage = encodeURIComponent(npmPackage);
        let r = await fetch(this.apiHost + `/downloads/point/${period}/${npmPackage}`);
        let j = await r.json();
        return j;
    }

    /**
     * Get the npms score for the package in format:
     * 
     * {
     *   analyzedAt: "2021-08-19T14:17:20.433Z"
     *   collected: {metadata: {…}, npm: {…}}
     *   evaluation: {quality: {…}, popularity: {…}, maintenance: {…}}
     *   score: {final: 0.03145670420721216, detail: {
     *      maintenance: 0
     *      popularity: 0
     *      quality: 0.1048556806907072
     *   }}
     * 
     * @param {string} package 
     */
    async getScore(npmPackage) {
        npmPackage = encodeURIComponent(npmPackage);
        let r = await fetch(this.npmsHost + '/package/' + npmPackage);
        let j = r.json();
        return j;
    }

    /**
     * Get score multi
     * 
     * https://api.npms.io/v2/package/mget
Example usage
curl -X POST "https://api.npms.io/v2/package/mget" \
	    -H "Accept: application/json" \
	    -H "Content-Type: application/json" \
	    -d '["cross-spawn", "react"]'
     */
}

export default ApiNPM;
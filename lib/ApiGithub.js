import fetch from "node-fetch";

class ApiGithub {
    constructor(githubID, repoName) {
        this.githubID = githubID;
        this.repoName = repoName;
    }

    async get(url) {
        let r = await fetch(url);
        console.log('ApiGithub status', r.status)
        let j = await r.json();
        return j;
    }

    async getRepositoryInfo() {
        let j = await this.get(`https://api.github.com/orgs/${this.githubID}/repos`);
        let repoInfo = j.filter(x => x.name === this.repoName)[0];
        return repoInfo;
    }

    async getPullRequests(state) {
        let j = await this.get(`https://api.github.com/repos/${this.githubID}/${this.repoName}/pulls`)

        if(state) {
            j = j.filter(x => x.state === state);
        }

        return j;
    }

    async lsTree(path, branch='main') {
        let url = `https://api.github.com/repos/${this.githubID}/${this.repoName}/git/trees/${branch}?recursive=1`;
        console.log('url', url);
        let j = await this.get(url);

        let tree = j.tree;

        if(path) {
            tree = tree.filter(x => x.path === path);
        }

        return tree;
    } 

    getRawContentURL(branch, file_path) {
        return `https://raw.githubusercontent.com/${this.githubID}/${this.repoName}/${branch}/${file_path}`;
    }
}

export default ApiGithub;
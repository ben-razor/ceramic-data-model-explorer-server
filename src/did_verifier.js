import { CeramicClient } from '@ceramicnetwork/http-client';
import ThreeIdResolver from '@ceramicnetwork/3id-did-resolver';
import { DID } from 'dids';

class DidVerifier {

    constructor(apiUrl) {
        this.apiUrl = apiUrl;
    }

    async verifyJWS(did, message) {
        let success = true;
        let reason = '';
        let isVerified = false;
        let verifiedInfo;

        try {
            const _ceramic = new CeramicClient(this.apiUrl);

            const resolver = {
                ...ThreeIdResolver.getResolver(_ceramic),
            }
            const _did = new DID({ resolver })
            _ceramic.did = _did;

            let ver = await _did.verifyJWS(message);
            verifiedInfo = ver;

            if(ver.kid && ver.kid.split('?')[0] === did) {
                isVerified = true;
            }
            else {
                success = false;
                reason = 'error-jws-mismatch';
            }
        }
        catch(e) {
            success = false;
            reason = 'error-performing-jws-verification:' + e.toString();
        }

        return { success, reason, isVerified, verifiedInfo };
    }
}


export default DidVerifier;
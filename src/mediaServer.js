const mediasoup = require("mediasoup");
const confif = require('../Config');

let worker;
let router;

const createWorker = async () => {
    worker = await mediasoup.createWorker({
        rtcMinPort: 2000,
        rtcMaxPort: 2020,
    })

    console.log(`worker pid ${worker.pid}`);
    console.log(worker)
    worker.on('died', err => {
        console.log("mediasoup worker process died")
        setTimeout(() => process.exit(1), 2000)
    })
    
    return worker;
}

const createWebRTCTransport = async (router, callback) => {
    try{

        let transport = await router.createWebRtcTransport(confif.transport);
        console.log("transport id:", transport.id);

        // The 'dtlsstatechange' event is raised when the DTLS state changes.
        // It is important to handle this event to perform necessary actions
        // when the transport's DTLS state changes to 'closed'. In this case,
        // we log a message and close the transport.

        transport.on('dtlsstatechange', (dtlsState) => {
            if(dtlsState === 'closed'){
                console.log("transport closed")
                transport.close();
            }
        })

        transport.on('close', () => {
            console.log("transport closed")
        })

        callback({
            params: {
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
            }
        })

        return transport;
    }catch(err){
        console.error(err);
        callback({
            params: {
                error: err
            }
        })
    }
}

module.exports = {
    createWorker,
    createWebRTCTransport,
}
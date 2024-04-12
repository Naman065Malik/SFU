const mediasoup = require("mediasoup");

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
        const Transport_options = {
            listenIps: [
                {
                    ip: "0.0.0.0", // for testing
                    announcedIp: "172.17.0.1",
                    // ip: request.connection.remoteAddress, // Use the IP address of the incoming connection
                }
            ],
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
        }

        // const Transport_options = {
        //     listenIps: [
        //         {
        //             ip: "0.0.0.0", // for testing
        //             announcedIp: "127.0.0.1",
        //             // ip: request.connection.remoteAddress, // Use the IP address of the incoming connection
        //         }
        //     ],
        //     enableUdp: true,
        //     enableTcp: true,
        //     preferUdp: true,
        //     iceServers: [
        //         {
        //             urls: 'stun:stun.l.google.com:19302'
        //         },
        //         {
        //             urls: 'stun:stun1.l.google.com:19302'
        //         },
        //         {
        //             urls: 'stun:stun2.l.google.com:19302'
        //         },
        //         {
        //             urls: 'stun:stun3.l.google.com:19302'
        //         },
        //         {
        //             urls: 'stun:stun4.l.google.com:19302'
        //         }
        //     ]
        // }

        let transport = await router.createWebRtcTransport(Transport_options);
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
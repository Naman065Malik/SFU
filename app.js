const express = require('express');
const http = require('http')
const socketIo = require('socket.io');
const mediasoup = require('mediasoup');
const { create } = require('domain');

const app = express();
const Server = http.createServer(app);
const io = socketIo(Server);
const port = 8080;

app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.get('/message', (req, res) => {
    res.sendFile(__dirname + '/public/test.html');
});

const { createWebRTCTransport } = require('./src/mediaServer');

let worker;
let router;
let producerTransport;
let consumerTransport;
let producer;
let consumer;

const createWorker = async () => {
    worker = await mediasoup.createWorker({
        rtcMinPort: 2000,
        rtcMaxPort: 2020,
    })

    console.log(`worker pid ${worker.pid}`);
    // console.log(worker)
    worker.on('died', err => {
        console.log("mediasoup worker process died")
        setTimeout(() => process.exit(1), 2000)
    })
}

worker = createWorker();

const mediaCodecs = [
    {
        kind: "audio",
        mimeType: "audio/opus",
        clockRate: 48000,
        channels: 2,
    },
    {
        kind: "video",
        mimeType: "video/VP8",
        clockRate: 90000,
        parameters: {
            "x-google-start-bitrate": 1000,
        },
    },
];

io.on('connection', async (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('message', (message) => {
        console.log('Received message:', message);
    });

    socket.on('getRouterRtpCapabilities', (callback) => {
        const data = router.rtpCapabilities;
        console.log('getRouterRtpCapabilities:', data);
        callback(data);
    });

    socket.on('createWebRtcTransport', async ({sender}, callback) => {
        console.log('createWebRTCTransport:', sender);
        if(sender) {
            producerTransport = await createWebRTCTransport(router, callback)
        }
        else{
            consumerTransport = await createWebRTCTransport(router, callback)
        }
    });

    socket.on('connectTransport', async ({ dtlsParameters }) => {
        console.log('connectTransport:', dtlsParameters);
        await producerTransport.connect({ dtlsParameters });
    });

    socket.on('produceTransport', async ({ kind, rtpParameters, appData }, callback) => {
        console.log('produceTransport:', kind, rtpParameters, appData);
        producer = await producerTransport.produce({
            kind,
            rtpParameters,
            appData,
        });

        console.log('producer:', producer.id);

        producer.on('transportclose', () => {
            console.log('producer transport closed');
            producer.close();
        });

        callback({ id: producer.id });
    });

    socket.on('transport-recv-connect', async ({ dtlsParameters }) => {
        console.log('transport-recv-connect:', dtlsParameters);
        await consumerTransport.connect({ dtlsParameters });
    });

    socket.on('consume', async ({ rtpCapabilities }, callback) => {
        try{
            console.log('producer:', producer);
            if(router.canConsume({
                producerId: producer.id,
                rtpCapabilities
            })) {
                consumer = await consumerTransport.consume({
                    producerId: producer.id,
                    rtpCapabilities,
                    paused: true,
                })

                consumer.on('transportclose', () => {
                    console.log('consumer transport closed');
                    consumer.close();
                });

                consumer.on('producerclose', () => {
                    console.log('producer closed');
                    consumer.close();
                });

                const params = {
                    id: consumer.id,
                    producerId: producer.id,
                    kind: consumer.kind,
                    rtpParameters: consumer.rtpParameters,
                }

                callback({params});
            }
        } 
        catch (err){
            console.error(err);
            callback({
                params: {
                    error: err 
                }
            });
        }
    });

    socket.on('resumeConsumer', async () => {
        console.log('resumeConsumer');
        await consumer.resume();
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });

    router = await worker.createRouter({ mediaCodecs });
    console.log(router);
});



Server.listen(port, () => {
    console.log(`WebSocket server is running on port ${port}`);
});
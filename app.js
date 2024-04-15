const express = require('express');
const http = require('http')
const socketIo = require('socket.io');
const mediasoup = require('mediasoup');

const config = require('./Config');

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
    worker = await mediasoup.createWorker(config.mediasoup.worker)

    console.log(`worker pid ${worker.pid}`);
    // console.log(worker)
    worker.on('died', err => {
        console.log("mediasoup worker process died")
        setTimeout(() => process.exit(1), 2000)
    })
}

worker = createWorker();

io.on('connection', async (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('message', (message) => {
        console.log('Received message:', message);
    });

    // To get Router RTP Capabilities for device creation on client side (Redis Data)
    socket.on('getRouterRtpCapabilities', (callback) => {
        const data = router.rtpCapabilities;
        console.log('getRouterRtpCapabilities:', data);
        callback(data);
    });

    // Create WebRTC Transport and send ICE parameters to client (MediaSoup Servis Data)
    socket.on('createWebRtcTransport', async ({sender}, callback) => {
        console.log('createWebRTCTransport:', sender);
        if(sender) {
            producerTransport = await createWebRTCTransport(router, callback)
        }
        else{
            consumerTransport = await createWebRTCTransport(router, callback)
        }
    });

    // Connect Transport and Get DTLS parameters from client (Client Data)
    socket.on('connectTransport', async ({ dtlsParameters }) => {
        console.log('connectTransport:', dtlsParameters);
        await producerTransport.connect({ dtlsParameters });
    });

    // Produce Media and send Producer ID to client (MediaSoup Servis Data)
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

    // Connect Recv Transport and Get DTLS parameters from client (Client Data)
    socket.on('transport-recv-connect', async ({ dtlsParameters }) => {
        console.log('transport-recv-connect:', dtlsParameters);
        await consumerTransport.connect({ dtlsParameters });
    });

    // Consume Media and send Consumer parameters to client (MediaSoup Servis Data)
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

    // Resume Consumer Suggested by mediasoup library
    socket.on('resumeConsumer', async () => {
        console.log('resumeConsumer');
        await consumer.resume();
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });

    // Create Room Event Required for multiple Routers
    // Currently only one Router is created 
    router = await worker.createRouter(config.mediasoup.router);
    console.log(router);
});



Server.listen(port, () => {
    console.log(`WebSocket server is running on port ${port}`);
});
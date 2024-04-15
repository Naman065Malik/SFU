const os = require('os');

function getIPv4() {
    const ifaces = os.networkInterfaces();
    for (const interfaceName in ifaces) {
        const iface = ifaces[interfaceName];
        for (const { address, family, internal } of iface) {
            if (family === 'IPv4' && !internal) {
                console.log(`Found IPv4 address: ${address}`);
                return address;
            }
        }
    }
    return '0.0.0.0'; // Default to 0.0.0.0 if no external IPv4 address found
}

const IPv4 = getIPv4();

const config = {

    // Mediasoup Worker mediacodecs
    mediasoup: {
        worker: {
            rtcMinPort: 2000,
            rtcMaxPort: 2020,
            // Suggested by Copilot
            // logLevel: 'warn',
            // logTags: [
            //     'info',
            //     'ice',
            //     'dtls',
            //     'rtp',
            //     'srtp',
            //     'rtcp',
            // ],
            // rtcIPv4: true,
            // rtcIPv6: false,
        },
        router: {
            mediaCodecs: [
                {
                    kind: 'audio',
                    mimeType: 'audio/opus',
                    clockRate: 48000,
                    channels: 2,
                },
                {
                    kind: 'video',
                    mimeType: 'video/VP8',
                    clockRate: 90000,
                    parameters: {
                        'x-google-start-bitrate': 1000,
                    },
                },
            ],
        },
    },
    
    // Transport options
    transport: {
        listenIps: [
            {
                ip: '0.0.0.0',
                announcedIp: IPv4,
            },
        ],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        // Suggested by Copilot
        // initialAvailableOutgoingBitrate: 800000,
        // minimumAvailableOutgoingBitrate: 600000,
    },
    
    // Other configurations
    maxIncomingBitrate: 1500000,
    initialAvailableOutgoingBitrate: 1000000,
    minimumAvailableOutgoingBitrate: 600000,
    maxSctpMessageSize: 262144,
};

module.exports = config;
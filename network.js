import { decryptMessage, encryptMessage } from './crypto.mjs';
import { processReceivedData } from './script.js';
import { showPopup, hidePopup } from './script.js';
import { startRecording } from './script.js';

const urlParams = new URLSearchParams(window.location.search);

let socket;
let sharedSecret = null;
let clientKeyPair = null;
let dhParams = null;
let dhExchangeStep = 0; // 0: waiting for params, 1: waiting for server public key

document.onload = function() {
    const ip = urlParams.get('ip');
    const port = urlParams.get('port');
    socket = new WebSocket(`ws://${ip}:${port}`);
    socket.addEventListener('open', () => {
        console.log('Verbindung zum Server hergestellt');
        showPopup('Encrypting connection...');
        // Wait for DH params from server
    });

    socket.addEventListener('message', async (event) => {
        const data = event.data;
        if (data instanceof ArrayBuffer) {
            await handleServerMessage(data);
        } else {
            console.log('Nachricht vom Server:', data);
        }
    });
};

// Helper to read a length-prefixed value from a DataView (big-endian 4-byte length)
function readLengthPrefixed(view, offset) {
    const len = view.getUint32(offset, false); // big-endian
    offset += 4;
    const value = new Uint8Array(view.buffer, view.byteOffset + offset, len);
    offset += len;
    return { value, offset };
}

// Receives and imports DH params, then generates client key pair
async function importDHParamsAndStartExchange(encodedDHParams) {
    try {
        // Parse: [4][p][4][g]
        const view = new DataView(encodedDHParams);
        let offset = 0;
        const { value: prime, offset: offset2 } = readLengthPrefixed(view, offset);
        const { value: generator } = readLengthPrefixed(view, offset2);

        // Import params for WebCrypto
        dhParams = { prime, generator };

        await generateClientDHKeyPair(dhParams);
    } catch (error) {
        console.error('Fehler beim Importieren der DH-Parameter:', error);
        showPopup("An error occurred! Please try again.");
    }
}

async function generateClientDHKeyPair(dhParams) {
    try {
        clientKeyPair = await window.crypto.subtle.generateKey(
            {
                name: 'DH',
                prime: dhParams.prime,
                generator: dhParams.generator,
            },
            true,
            ['deriveKey', 'deriveBits']
        );
        console.log('Client DH-Schlüsselpaar generiert:', clientKeyPair);
        await sendClientPublicKey(clientKeyPair.publicKey);
        dhExchangeStep = 1; // Now wait for server public key
    } catch (error) {
        console.error('Fehler beim Generieren des Client DH-Schlüsselpaares:', error);
        showPopup("An error occurred! Please try again.");
    }
}

async function sendClientPublicKey(publicKey) {
    try {
        const clientPublicKeyEncoded = await window.crypto.subtle.exportKey('raw', publicKey);
        // Send as [4][key]
        const len = clientPublicKeyEncoded.byteLength;
        const buf = new Uint8Array(4 + len);
        const view = new DataView(buf.buffer);
        view.setUint32(0, len, false); // big-endian
        buf.set(new Uint8Array(clientPublicKeyEncoded), 4);
        socket.send(buf);
    } catch (error) {
        console.error('Fehler beim Exportieren des Client Public Keys:', error);
        showPopup("An error occurred! Please try again.");
    }
}

async function handleServerMessage(data) {
    if (!sharedSecret) {
        try {
            if (dhExchangeStep === 0) {
                // First message: DH params from server
                await importDHParamsAndStartExchange(data);
            } else if (dhExchangeStep === 1) {
                // Second message: server public key ([4][key])
                const view = new DataView(data);
                const { value: serverPubKey } = readLengthPrefixed(view, 0);

                const serverPublicKey = await window.crypto.subtle.importKey(
                    'raw',
                    serverPubKey,
                    {
                        name: 'DH',
                        prime: dhParams.prime,
                        generator: dhParams.generator,
                    },
                    false,
                    []
                );
                sharedSecret = await window.crypto.subtle.deriveKey(
                    {
                        name: 'DH',
                        public: serverPublicKey,
                        private: clientKeyPair.privateKey,
                    },
                    {
                        name: 'AES-CBC',
                        length: 256,
                    },
                    true,
                    ['encrypt', 'decrypt']
                );
                console.log('Shared Secret erfolgreich abgeleitet:', sharedSecret);
                socket.send(urlParams.get('token'));
                startRecording();
                hidePopup();
                dhExchangeStep = 2;
            }
        } catch (e) {
            console.error("Fehler beim DH-Schlüsselaustausch", e);
            showPopup("An error occurred! Please try again.");
        }
    } else {
        processReceivedData(decryptMessage(data));
    }
}

export async function sendMessage(message) {
    try {
        const encryptedMessage = await encryptMessage(message);
        socket.send(encryptedMessage);
    } catch (error) {
        console.error('Fehler beim Senden der Nachricht:', error);
        showPopup("An error occurred! Please try again.");
    }
}

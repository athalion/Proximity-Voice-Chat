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

document.addEventListener('DOMContentLoaded', function() {
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
        // Während des DH-Austauschs: Text ODER ArrayBuffer an handleServerMessage
        if (!sharedSecret) {
            await handleServerMessage(data);
        } else if (data instanceof ArrayBuffer) {
            await handleServerMessage(data);
        } else {
            console.log('Nachricht vom Server:', data);
        }
    });
});

// Helper to decode Base64 to Uint8Array
function base64ToBytes(b64) {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; ++i) arr[i] = bin.charCodeAt(i);
    return arr;
}

// Helper to encode Uint8Array to Base64
function bytesToBase64(arr) {
    let bin = '';
    for (let i = 0; i < arr.length; ++i) bin += String.fromCharCode(arr[i]);
    return btoa(bin);
}

// Receives and imports DH params, then generates client key pair
async function importDHParamsAndStartExchange(jsonString) {
    try {
        const obj = JSON.parse(jsonString);
        const prime = base64ToBytes(obj.data.prime);
        const generator = base64ToBytes(obj.data.generator);

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
        const clientPublicKeyEncoded = new Uint8Array(await window.crypto.subtle.exportKey('raw', publicKey));
        const msg = JSON.stringify(
            {
                type: 'key',
                data: {
                    key: bytesToBase64(clientPublicKeyEncoded)
                }
            }
        );
        socket.send(msg);
    } catch (error) {
        console.error('Fehler beim Exportieren des Client Public Keys:', error);
        showPopup("An error occurred! Please try again.");
    }
}

async function handleServerMessage(data) {
    if (!sharedSecret) {
        try {
            if (dhExchangeStep === 0) {
                await importDHParamsAndStartExchange(typeof data === 'string' ? data : await data.text());
            } else if (dhExchangeStep === 1) {
                const obj = JSON.parse(typeof data === 'string' ? data : await data.text());
                const serverPubKey = base64ToBytes(obj.data.key);

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

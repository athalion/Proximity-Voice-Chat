import { decryptMessage, encryptMessage } from './crypto.mjs';
import { processReceivedData } from './script.js';
import { showPopup, hidePopup } from './script.js';
import { startRecording } from './script.js';
import { BigInteger } from 'jsbn';
import { randomBytes } from 'crypto'; // Für Node.js, im Browser musst du window.crypto verwenden

const urlParams = new URLSearchParams(window.location.search);

let socket;
let sharedSecret = null;
let clientPrivate = null;
let clientPublic = null;
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
        const prime = new BigInteger(atob(obj.data.prime), 256);
        const generator = new BigInteger(atob(obj.data.generator), 256);

        dhParams = { prime, generator };

        // 1. Client Private Key generieren (zufällig, 2048 Bit)
        const privBytes = new Uint8Array(256);
        window.crypto.getRandomValues(privBytes);
        clientPrivate = new BigInteger(privBytes);

        // 2. Client Public Key berechnen: g^a mod p
        clientPublic = generator.modPow(clientPrivate, prime);

        // 3. Public Key an Server senden (Base64)
        const clientPubB64 = btoa(clientPublic.toByteArray().reduce((s, b) => s + String.fromCharCode(b), ''));
        socket.send(JSON.stringify({
            type: 'key',
            data: { key: clientPubB64 }
        }));
    } catch (error) {
        console.error('Fehler beim Importieren der DH-Parameter:', error);
        showPopup("An error occurred! Please try again.");
    }
}

// Wenn Server Public Key kommt:
async function handleServerMessage(data) {
    if (!sharedSecret) {
        if (dhExchangeStep === 0) {
            await importDHParamsAndStartExchange(typeof data === 'string' ? data : await data.text());
            dhExchangeStep = 1;
        } else if (dhExchangeStep === 1) {
            const obj = JSON.parse(typeof data === 'string' ? data : await data.text());
            const serverPubKey = new BigInteger(atob(obj.data.key), 256);

            // Shared Secret berechnen: (ServerPubKey)^clientPrivate mod prime
            sharedSecret = serverPubKey.modPow(clientPrivate, dhParams.prime);

            // sharedSecret ist ein BigInteger, du kannst daraus einen Key ableiten (z.B. SHA-256 Hash)
            // Beispiel: SHA-256 Hash als AES-Key
            const secretBytes = sharedSecret.toByteArray();
            const hashBuffer = await window.crypto.subtle.digest('SHA-256', new Uint8Array(secretBytes));
            // hashBuffer als AES-Key verwenden

            // Jetzt kannst du verschlüsselte Kommunikation starten
            socket.send(urlParams.get('token'));
            startRecording();
            hidePopup();
            dhExchangeStep = 2;
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

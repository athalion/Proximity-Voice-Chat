import { decryptMessage, encryptMessage } from './crypto.mjs';
import { processReceivedData } from './script.js';
import { showPopup, hidePopup } from './script.js';

let socket;

document.onload(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const ip = urlParams.get('ip');
    const port = urlParams.get('port');
    socket = new WebSocket(`ws://${ip}:${port}`);
    socket.addEventListener('open', () => {
        console.log('Verbindung zum Server hergestellt');
        showPopup('Encrypting connection...');
        performDHExchange();
    });
});

async function performDHExchange() {
    try {
        const keyPair = await window.crypto.subtle.generateKey(
            {
                name: 'DH',
                modulusLength: 2048,
                publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
            },
            true,
            ['deriveKey']
        );

        const clientPublicKey = await window.crypto.subtle.exportKey('raw', keyPair.publicKey);

        socket.send(clientPublicKey);

        socket.addEventListener('message', async (event) => {
            const data = event.data;
            if (data instanceof ArrayBuffer) {
                await handleServerMessage(decryptMessage(data));
            } else {
                console.log('Nachricht vom Server:', data);
            }
        });

    } catch (error) {
        console.error('Fehler beim DH-Schlüsselaustausch:', error);
        showPopup("An error occurred! Please try again.");
    }
}

async function handleServerMessage(data) {
    if (!sharedSecret) {
        try{
            const serverPublicKeyRaw = data;

            const serverPublicKey = await window.crypto.subtle.importKey(
                'raw',
                serverPublicKeyRaw,
                { name: 'DH', publicExponent: new Uint8Array([0x01, 0x00, 0x01]) },
                false,
                []
            );

            sharedSecret = await window.crypto.subtle.deriveKey(
                {
                    name: 'DH',
                    public: serverPublicKey,
                    privateKey: keyPair.privateKey,
                },
                {
                    name: 'AES-CBC',
                    length: 256,
                },
                true,
                ['encrypt', 'decrypt']
            );
            console.log('Shared Secret erfolgreich abgeleitet:', sharedSecret);
            hidePopup();
        } catch(e){
            console.error("Fehler beim Importieren des Server Public Key", e);
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

import { processReceivedData } from './script.js';
import { showPopup, hidePopup } from './script.js';
import { startRecording } from './script.js';

const urlParams = new URLSearchParams(window.location.search);

let socket;

document.addEventListener('DOMContentLoaded', function() {
    const ip = urlParams.get('ip');
    const port = urlParams.get('port');
    socket = new WebSocket(`ws://${ip}:${port}`);
    socket.addEventListener('open', () => {
        console.log('Verbindung zum Server hergestellt');
        showPopup('Verbindung hergestellt...');
        socket.send(JSON.stringify(
            {
                type: 'token',
                data: {
                    token: urlParams.get('token'),
                }
            }
        ));
        startRecording();
        hidePopup();
    });

    socket.addEventListener('message', async (event) => {
        const data = event.data;
        processReceivedData(data);
    });
});

export async function sendMessage(message) {
    try {
        socket.send(message);
    } catch (error) {
        console.error('Fehler beim Senden der Nachricht:', error);
        showPopup("An error occurred! Please try again.");
    }
}

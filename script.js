import { addUser, removeUser, clearUserList, updateLayout } from "./user-manager.mjs";
import { sendMessage } from "./network.js";

let audioContext;

document.onclose = function() {
    sendMessage(JSON.stringify({ type: 'userLeave', data: { name: 'User' } }));
    if (audioContext) {
        audioContext.close().then(() => {
            console.log('AudioContext geschlossen.');
        }).catch(error => {
            console.error('Fehler beim Schließen des AudioContext:', error);
        });
    }
};

export async function startRecording() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    try {
        const userMediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        await audioContext.audioWorklet.addModule('audio-processor.js');
        const audioWorkletNode = new AudioWorkletNode(audioContext, 'audio-processor');

        const source = audioContext.createMediaStreamSource(userMediaStream);
        source.connect(audioWorkletNode);

        audioWorkletNode.port.onmessage = (event) => {
            const audioData = event.data.buffer;
            sendAudioData(audioData);
        };

    } catch (error) {
        console.error('Fehler beim Starten der Audioaufnahme:', error);
        showPopup('Error starting audio recording: ' + error.message);
    }
}

async function sendAudioData(audioBuffer) {
    try {
        const audioPacket = {
            type: 'audio',
            data: audioBuffer
        };
        sendMessage(JSON.stringify(audioPacket));
    } catch (error) {
        console.error('Fehler beim Senden der Audio-Daten:', error);
        showPopup('Error sending audio data: ' + error.message);
    }
}

export async function processReceivedData(data){
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    const JSONData = JSON.parse(data);
    switch (JSONData.type) {
        case 'userJoin':
            addUser(JSONData.data.uuid, JSONData.data.name);
            break;
        case 'userLeave':
            removeUser(JSONData.data.uuid);
            break;
        case 'userList':
            clearUserList();
            JSONData.data.forEach(user => {
                addUser(user.uuid, user.name);
            });
            updateLayout();
            break;
        case 'userKick':
            window.close();
            break;
        case 'roomTerminate':
            window.close();
            break;
        case 'invalidToken':
            showPopup('Invalid token! Please check your link.');
            break;
        case 'audio':
            const audioData = JSONData.data;
            const listenerPosition = JSONData.listenerPosition;
            const senderPosition = JSONData.soundSourcePosition;
            const listenerForward = JSONData.forwardVecor;
            const listenerUp = JSONData.upVector;

            if (audioData && senderPosition && audioContext && audioContext.listener && listenerForward && listenerUp) {
                audioContext.listener.setPosition(listenerPosition.x, listenerPosition.y, listenerPosition.z);

                audioContext.listener.forwardX.value = listenerForward.x;
                audioContext.listener.forwardY.value = listenerForward.y;
                audioContext.listener.forwardZ.value = listenerForward.z;

                audioContext.listener.upX.value = listenerUp.x;
                audioContext.listener.upY.value = listenerUp.y;
                audioContext.listener.upZ.value = listenerUp.z;

                playNetworkedAudio(audioData, senderPosition);
            } else {
                console.warn("Audio-Paket ohne Audio-Daten oder Senderposition erhalten.");
            }
            break;
        default:
            console.error('Unbekannter Nachrichtentyp:', JSONData.type);
            showPopup('Received unknown message type: ' + JSONData.type);
            break;
    }
}

function playNetworkedAudio(audioBuffer, senderPosition) {
    audioContext.decodeAudioData(audioBuffer).then(buffer => {
        const source = audioContext.createBufferSource();
        source.buffer = buffer;

        const gainNode = audioContext.createGain();
        const pannerNode = audioContext.createPanner();

        pannerNode.setPosition(senderPosition.x, senderPosition.y, senderPosition.z);

        pannerNode.distanceModel = 'inverse';
        pannerNode.refDistance = 1;
        pannerNode.rolloffFactor = 1;
        pannerNode.panningModel = 'HRTF';

        source.connect(gainNode);
        gainNode.connect(pannerNode);
        pannerNode.connect(audioContext.destination);
        source.start();
    }).catch(error => {
        console.error('Fehler beim Dekodieren und Abspielen von Netzwerk-Audio:', error);
        showPopup("An error occurred! Please try again.");
    });
}

// Popup functionality
const popup = document.getElementById('popup');
const popupMessage = document.getElementById('popup-message');

// Function to show the popup with a custom message
export function showPopup(message) {
    popupMessage.textContent = message;
    popup.classList.remove('hidden');
    popup.classList.add('show');
}

// Function to hide the popup
export function hidePopup() {
    popup.classList.remove('show');
    setTimeout(() => {
        popup.classList.add('hidden');
    }, 300); // Match the CSS transition duration
}

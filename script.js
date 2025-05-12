import { addUser, removeUser, clearUserList, updateLayout } from "./user-manager.mjs";
import { sendMessage } from "./network.js";

let audioContext;

document.onload = function() {
    startRecording();
};

async function startRecording() {
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
    }
}

export async function processReceivedData(data){
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    const JSONData = JSON.parse(data);
    switch (JSONData.type) {
        case 'userJoin':
            addUser(JSONData.data.name);
            break;
        case 'userLeave':
            removeUser(JSONData.data.name);
            break;
        case 'userList':
            clearUserList();
            JSONData.data.forEach(user => {
                addUser(user.name);
            });
            updateLayout();
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
    });
}
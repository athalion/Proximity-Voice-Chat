import { addUser, removeUser } from "./user-manager.mjs";
import { sendMessage } from "./network.js";

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const audioQueue = [];
let playbackStartTime = null;

document.onload(() => {
    startRecording();
});

async function startRecording() {
    try {
        const userMediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        await audioContext.audioWorklet.addModule('audio-processor.js');
        const audioWorkletNode = new AudioWorkletNode(audioContext, 'audio-processor');

        const source = audioContext.createMediaStreamSource(userMediaStream);
        source.connect(audioWorkletNode);

        audioWorkletNode.port.onmessage = (event) => {
            const audioData = event.data;
            sendAudioData(audioData);
        };

    } catch (error) {
        console.error('Fehler beim Starten der Audioaufnahme:', error);
    }
}

async function sendAudioData(audioData) {
    const audioBuffer = audioData.buffer;

    try {
        const audioPacket = {
            type: 'audio',
            data: encryptedAudio
        };

        sendMessage(JSON.stringify(audioPacket));

    } catch (error) {
        console.error('Fehler beim Senden der Audio-Daten:', error);
    }
}

async function processReceivedData(data){
    const JSONData = await JSON.parse(data);
    if (JSONData.type === 'userJoin') {
        addUser(JSONData.data.name);
    } else if (JSONData.type === 'userLeave') {
        removeUser(JSONData.data.name);
    } else if(JSONData.type === 'audio') {
        const encryptedAudioData = JSONData.data;
        const timestamp = JSONData.timestamp;
        try {
            const decryptedAudioBuffer = await decryptMessage(encryptedAudioData);
            audioQueue.push({ buffer: decryptedAudioBuffer, timestamp: timestamp });
            scheduleNextPlayback();
        } catch (error) {
            console.error('Fehler beim Entschlüsseln der Audio-Daten:', error);
        }
    } else {
        console.error('Unbekannter Nachrichtentyp:', JSONData.type);
    }
}

function scheduleNextPlayback() {
    if (audioQueue.length > 0 && playbackStartTime === null) {
        playbackStartTime = audioContext.currentTime + 0.1;
    }

    while (audioQueue.length > 0 && audioQueue[0].timestamp <= (playbackStartTime * 1000)) {
        const audioItem = audioQueue.shift();
        playQueuedAudio(audioItem.buffer, playbackStartTime);
        playbackStartTime += audioItem.buffer.duration;
    }
}

function playQueuedAudio(audioBuffer, startTime) {
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start(startTime);
}

setInterval(scheduleNextPlayback, 1);
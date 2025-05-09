class AudioProcessor extends AudioWorkletProcessor {
    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];

        // Einfaches Durchleiten zur Ausgabe (für lokale Tests)
        if (output && input) {
            for (let channel = 0; channel < output.length; ++channel) {
                output[channel].set(input[channel]);
            }
        }

        // Sende die Audio-Daten als ArrayBuffer an den Haupt-Thread zur Weiterleitung
        if (input && input[0]) {
            this.port.postMessage({ buffer: input[0].buffer });
        }

        return true;
    }
}

registerProcessor('audio-processor', AudioProcessor);
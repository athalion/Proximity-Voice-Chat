export async function encryptMessage(message) {
    const iv = window.crypto.getRandomValues(new Uint8Array(16));
    const encoded = new TextEncoder().encode(message);

    const ciphertext = await window.crypto.subtle.encrypt(
        {
            name: "AES-CBC",
            iv: iv
        },
        sharedSecretKey,
        encoded
    );

    // IV + Ciphertext zusammenfügen
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);
    return combined.buffer;
}

export async function decryptMessage(data) {
    // data: ArrayBuffer (IV + Ciphertext)
    const bytes = new Uint8Array(data);
    const iv = bytes.slice(0, 16);
    const ciphertext = bytes.slice(16);

    // sharedSecretKey: CryptoKey, vorher erzeugt!
    const plaintext = await window.crypto.subtle.decrypt(
        {
            name: "AES-CBC",
            iv: iv
        },
        sharedSecretKey,
        ciphertext
    );
    return new TextDecoder().decode(plaintext);
}
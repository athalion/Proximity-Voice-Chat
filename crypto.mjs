export async function encryptMessage(message) {
    const iv = window.crypto.getRandomValues(new Uint8Array(16));
    const encryptedData = await window.crypto.subtle.encrypt(
        {
            name: 'AES-CBC',
            iv: iv,
        },
        sharedSecret,
        new TextEncoder().encode(message)
    );

    const result = new Uint8Array(iv.byteLength + encryptedData.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(encryptedData), iv.byteLength);
    return result;
}

export async function decryptMessage(encryptedMessageWithIV) {
    const iv = encryptedMessageWithIV.slice(0, 16);
    const encryptedData = encryptedMessageWithIV.slice(16);

    const decryptedData = await window.crypto.subtle.decrypt(
        {
            name: 'AES-CBC',
            iv: iv,
        },
        sharedSecret,
        encryptedData
    );
    return new TextDecoder().decode(decryptedData);
}
import { randomBytes } from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Generates a base32 ID in the format XXXX-XXXX-XXXX
 * Uses crypto.randomBytes for secure random number generation
 */
export function generateBase32Id(length: number = 12, groupSize: number = 4): string {
    const bytes = randomBytes(length);
    let result = '';
    for (let i = 0; i < length; i++) {
        // Grab the bottom 5 bits of the byte (0x1F = 31, so value is 0-31)
        const idx = bytes[i] & 0x1F;
        result += BASE32_ALPHABET[idx];
    }

    if (groupSize > 0) {
        result = result.match(new RegExp(`.{1,${groupSize}}`, 'g'))?.join('-') || '';
    }

    return result;
}
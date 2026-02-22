/* ============================================================
   translate.js – Client-side Translation Helper
   Calls the Google Apps Script endpoint deployed as Web App
   ============================================================ */

// Replace with your deployed GAS Web App URL
const GAS_TRANSLATE_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';

/**
 * Translate a single text string
 * @param {string} text    – Text to translate
 * @param {string} target  – Target language code (e.g. 'en', 'ko', 'ja')
 * @param {string} source  – Source language code (default: 'auto')
 * @returns {Promise<string>} Translated text
 */
export async function translateText(text, target, source = 'auto') {
    try {
        const params = new URLSearchParams({ text, source, target });
        const res = await fetch(`${GAS_TRANSLATE_URL}?${params}`);
        const data = await res.json();
        return data.translated || text;
    } catch {
        console.warn('Translation failed, returning original text');
        return text;
    }
}

/**
 * Translate multiple texts in a single batch request
 * @param {string[]} texts  – Array of texts to translate
 * @param {string}   target – Target language code
 * @param {string}   source – Source language code (default: 'auto')
 * @returns {Promise<string[]>} Array of translated texts
 */
export async function translateBatch(texts, target, source = 'auto') {
    try {
        const res = await fetch(GAS_TRANSLATE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texts, source, target }),
        });
        const data = await res.json();
        return data.results?.map(r => r.translated) || texts;
    } catch {
        console.warn('Batch translation failed, returning originals');
        return texts;
    }
}

/* ============================================================
   auto_seed.js – Automated Keyword & Image Seeding Pipeline
   
   Usage:
     node scripts/auto_seed.js              # Full seed
     node scripts/auto_seed.js --dry-run    # Preview without DB writes
   
   Flow:
     1. Scrape Google Trends RSS for 20 countries
     2. Insert new keywords into Supabase
     3. For keywords with 0 images, scrape DuckDuckGo Images
     4. Insert image URLs into Supabase
   ============================================================ */

import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';

// ─── Configuration ────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'YOUR_SERVICE_ROLE_KEY';
const DRY_RUN = process.argv.includes('--dry-run');
const IMAGES_PER_KW = 16;
const BOT_NICKNAME = 'Allreview Bot 🤖';
const BOT_COUNTRY = 'GL';

// Target countries (ISO 3166-1 alpha-2)
const TARGET_COUNTRIES = [
    'US', 'KR', 'JP', 'GB', 'DE', 'FR', 'BR', 'IN', 'CA', 'AU',
    'MX', 'IT', 'ES', 'RU', 'ID', 'TR', 'TH', 'VN', 'PH', 'NG',
];

// Google Trends RSS geo mapping
const GEO_MAP = {
    US: 'US', KR: 'KR', JP: 'JP', GB: 'GB', DE: 'DE',
    FR: 'FR', BR: 'BR', IN: 'IN', CA: 'CA', AU: 'AU',
    MX: 'MX', IT: 'IT', ES: 'ES', RU: 'RU', ID: 'ID',
    TR: 'TR', TH: 'TH', VN: 'VN', PH: 'PH', NG: 'NG',
};

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { fetch: fetch }
});

// ─── Main Pipeline ────────────────────────────────────────────
async function main() {
    console.log(`\n🚀 Allreview Auto-Seed Pipeline ${DRY_RUN ? '(DRY RUN)' : ''}`);
    console.log('═'.repeat(50));

    let totalKeywords = 0;
    let totalImages = 0;

    for (const country of TARGET_COUNTRIES) {
        console.log(`\n🌍 [${country}] Fetching trends...`);

        try {
            const keywords = await fetchTrendingKeywords(country);
            console.log(`   Found ${keywords.length} trending keywords`);

            for (const kw of keywords) {
                // Check if keyword already exists
                const exists = await keywordExists(kw, country);
                if (exists) {
                    console.log(`   ⏭️  "${kw}" already exists, skipping`);
                    continue;
                }

                // Insert keyword
                const keywordId = await insertKeyword(kw, country);
                if (!keywordId) continue;
                totalKeywords++;
                console.log(`   ✅ Inserted keyword: "${kw}" (id: ${keywordId})`);

                // Seed images
                const imageCount = await getImageCount(keywordId);
                if (imageCount === 0) {
                    console.log(`   📷 Fetching ${IMAGES_PER_KW} images for "${kw}"...`);
                    const images = await fetchImages(kw);
                    const inserted = await insertImages(keywordId, images);
                    totalImages += inserted;
                    console.log(`   ✅ Inserted ${inserted} images`);
                }

                // Rate limit: small delay between keywords
                await sleep(500);
            }
        } catch (err) {
            console.error(`   ❌ Error processing ${country}:`, err.message);
        }

        // Rate limit: delay between countries
        await sleep(1000);
    }

    console.log('\n' + '═'.repeat(50));
    console.log(`✅ Seed complete: ${totalKeywords} keywords, ${totalImages} images`);
}

// ─── Fetch Trending Keywords (Google Trends RSS) ──────────────
async function fetchTrendingKeywords(countryCode) {
    const geo = GEO_MAP[countryCode] || countryCode;
    const url = `https://trends.google.com/trending/rss?geo=${geo}`;

    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AllreviewBot/1.0)' },
        });
        const text = await res.text();
        const $ = cheerio.load(text, { xmlMode: true });

        const keywords = [];
        $('item title').each((_, el) => {
            const kw = $(el).text().trim();
            if (kw && kw.length > 0 && kw.length < 100) {
                keywords.push(kw);
            }
        });

        return keywords.slice(0, 10); // Limit to top 10 per country
    } catch (err) {
        console.error(`   ⚠️  Google Trends RSS failed for ${countryCode}:`, err.message);
        return [];
    }
}

// ─── Fetch Images (DuckDuckGo Image Search Scraper) ───────────
async function fetchImages(query) {
    try {
        // DuckDuckGo image search via their vqd token system
        const tokenUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`;
        const tokenRes = await fetch(tokenUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AllreviewBot/1.0)' },
        });
        const tokenText = await tokenRes.text();

        // Extract vqd token
        const vqdMatch = tokenText.match(/vqd=["']?([\w-]+)/);
        if (!vqdMatch) {
            console.log('   ⚠️  Could not extract DuckDuckGo vqd token, trying Pexels fallback');
            return await fetchPexelsFallback(query);
        }

        const vqd = vqdMatch[1];
        const searchUrl = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&p=1`;

        const imgRes = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; AllreviewBot/1.0)',
                'Referer': 'https://duckduckgo.com/',
            },
        });
        const imgData = await imgRes.json();

        const results = (imgData.results || [])
            .filter(r => r.image && r.image.startsWith('http'))
            .map(r => r.image)
            .slice(0, IMAGES_PER_KW);

        if (results.length > 0) return results;

        // Fallback to Pexels if DDG returns nothing
        return await fetchPexelsFallback(query);
    } catch (err) {
        console.error('   ⚠️  DDG image search error:', err.message);
        return await fetchPexelsFallback(query);
    }
}

// ─── Pexels Fallback (free API, 200 req/hour) ─────────────────
async function fetchPexelsFallback(query) {
    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) {
        console.log('   ⚠️  No PEXELS_API_KEY set, skipping fallback');
        return generatePlaceholders(query);
    }

    try {
        const res = await fetch(
            `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${IMAGES_PER_KW}`,
            { headers: { Authorization: apiKey } }
        );
        const data = await res.json();
        return (data.photos || []).map(p => p.src.large);
    } catch (err) {
        console.error('   ⚠️  Pexels fallback error:', err.message);
        return generatePlaceholders(query);
    }
}

// ─── Placeholder images when all sources fail ─────────────────
function generatePlaceholders(query) {
    const placeholders = [];
    for (let i = 0; i < IMAGES_PER_KW; i++) {
        const hue = (i * 23 + query.length * 7) % 360;
        // Use placehold.co with text
        placeholders.push(
            `https://placehold.co/600x600/${hslToHex(hue, 70, 45)}/ffffff?text=${encodeURIComponent(query.slice(0, 10))}&font=roboto`
        );
    }
    return placeholders;
}

function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `${f(0)}${f(8)}${f(4)}`;
}

// ─── Supabase DB Operations ──────────────────────────────────
async function keywordExists(keyword, countryCode) {
    const { data } = await supabase
        .from('keywords')
        .select('id')
        .eq('keyword_name', keyword)
        .eq('country_code', countryCode)
        .limit(1);
    return data && data.length > 0;
}

async function insertKeyword(keyword, countryCode) {
    if (DRY_RUN) {
        console.log(`   🔸 [DRY] Would insert keyword: "${keyword}" (${countryCode})`);
        return 999;
    }

    const { data, error } = await supabase
        .from('keywords')
        .insert({
            keyword_name: keyword,
            country_code: countryCode,
            is_global: false,
        })
        .select('id')
        .single();

    if (error) {
        console.error(`   ❌ Insert keyword failed:`, error.message);
        return null;
    }
    return data.id;
}

async function getImageCount(keywordId) {
    if (DRY_RUN) return 0;
    const { count } = await supabase
        .from('images')
        .select('id', { count: 'exact', head: true })
        .eq('keyword_id', keywordId);
    return count || 0;
}

async function insertImages(keywordId, imageUrls) {
    if (DRY_RUN) {
        console.log(`   🔸 [DRY] Would insert ${imageUrls.length} images`);
        return imageUrls.length;
    }

    const rows = imageUrls.map(url => ({
        keyword_id: keywordId,
        image_url: url,
        uploader_nickname: BOT_NICKNAME,
        uploader_country: BOT_COUNTRY,
    }));

    const { error } = await supabase
        .from('images')
        .insert(rows);

    if (error) {
        console.error(`   ❌ Insert images failed:`, error.message);
        return 0;
    }
    return rows.length;
}

// ─── Utility ──────────────────────────────────────────────────
function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// ─── Run ──────────────────────────────────────────────────────
main().catch(err => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
});

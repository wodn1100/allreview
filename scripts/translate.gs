/**
 * ============================================================
 * translate.gs – Google Apps Script Translation REST Endpoint
 * 
 * SETUP:
 * 1. Go to https://script.google.com
 * 2. Create a new project named "Allreview Translate"
 * 3. Paste this entire code into Code.gs
 * 4. Click Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the deployment URL (this is your free translation API)
 * 
 * USAGE:
 *   GET  {URL}?text=Hello&source=en&target=ko
 *   POST {URL}  body: { text: "Hello", source: "en", target: "ko" }
 *   Batch: POST { texts: ["Hello","World"], source: "en", target: "ko" }
 * ============================================================
 */

// ─── GET Handler ──────────────────────────────────────────────
function doGet(e) {
  var text   = e.parameter.text   || '';
  var source = e.parameter.source || 'auto';
  var target = e.parameter.target || 'en';

  if (!text) {
    return jsonResponse({ error: 'Missing "text" parameter' }, 400);
  }

  var translated = translateText(text, source, target);
  return jsonResponse({
    original:   text,
    translated: translated,
    source:     source,
    target:     target
  });
}

// ─── POST Handler ─────────────────────────────────────────────
function doPost(e) {
  try {
    var body   = JSON.parse(e.postData.contents);
    var source = body.source || 'auto';
    var target = body.target || 'en';

    // Batch translation
    if (body.texts && Array.isArray(body.texts)) {
      var results = body.texts.map(function(t) {
        return {
          original:   t,
          translated: translateText(t, source, target)
        };
      });
      return jsonResponse({ results: results, source: source, target: target });
    }

    // Single translation
    var text = body.text || '';
    if (!text) {
      return jsonResponse({ error: 'Missing "text" field' }, 400);
    }

    var translated = translateText(text, source, target);
    return jsonResponse({
      original:   text,
      translated: translated,
      source:     source,
      target:     target
    });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

// ─── Core Translation (Google's Free LanguageApp) ─────────────
function translateText(text, source, target) {
  try {
    if (source === 'auto') {
      return LanguageApp.translate(text, '', target);
    }
    return LanguageApp.translate(text, source, target);
  } catch (err) {
    Logger.log('Translation error: ' + err.message);
    return text; // Return original on failure
  }
}

// ─── JSON Response Helper ─────────────────────────────────────
function jsonResponse(data, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ─── Health Check ─────────────────────────────────────────────
function doHealthCheck() {
  var result = translateText('Hello', 'en', 'ko');
  Logger.log('Health check: Hello → ' + result);
  return result;
}

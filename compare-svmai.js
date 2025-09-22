/**
 * compare-svmai.js
 * Fetches local API answer for $SVMAI and compares with CoinGecko opensvm-com.
 * Writes a structured report to svmai-verify.json for later inspection.
 */
const fs = require('fs');

function parseNumber(str) {
  if (typeof str !== 'string') return NaN;
  // Remove $ , spaces, and thin spaces
  const cleaned = str.replace(/[\$, ,\u00A0\s]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function extractFromLocalAnswer(text) {
  // Robust extraction anywhere in the text (header can be preceded/succeeded by other content)
  const out = {};
  const priceM = text.match(/-\s*Current Price:\s*\$([0-9.,\s\u00A0]+)/i);
  if (priceM) out.current_price_usd = parseNumber(priceM[1]);
  const capM = text.match(/-\s*Market Cap:\s*\$([0-9.,\s\u00A0]+)/i);
  if (capM) out.market_cap_usd = parseNumber(capM[1]);
  const volM = text.match(/-\s*24h Volume:\s*\$([0-9.,\s\u00A0]+)/i);
  if (volM) out.total_volume_usd_24h = parseNumber(volM[1]);
  return out;
}

async function main() {
  const question = 'What is the current price, market cap, and recent trading volume for the memecoin $SVMAI on Solana?';
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const altBase = base.includes(':3000') ? base.replace(':3000', ':3001') : 'http://localhost:3001';
  const localUrl = `${base}/api/getAnswer`;
  const cgUrl = 'https://api.coingecko.com/api/v3/coins/opensvm-com?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false';

  const report = {
    timestamp: new Date().toISOString(),
    question,
    local: {},
    coingecko: {},
    deltas: {},
    ok: false
  };

  try {
    const localRes = await fetch(localUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });
    const localText = await localRes.text();

    report.local_raw_length = localText.length;
    report.local = extractFromLocalAnswer(localText);

    // If parsing failed or body looks empty, try alternative base (port 3001)
    if (!report.local.current_price_usd || !report.local.market_cap_usd || !report.local.total_volume_usd_24h) {
      try {
        const altRes = await fetch(`${altBase}/api/getAnswer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question })
        });
        const altText = await altRes.text();
        report.local_raw_length_alt = altText.length;
        const altParsed = extractFromLocalAnswer(altText);
        if (altParsed.current_price_usd && altParsed.market_cap_usd && altParsed.total_volume_usd_24h) {
          report.local = altParsed;
          report.local_source = `${altBase}/api/getAnswer`;
        }
      } catch (e) {
        // ignore
      }
    }

    const cgRes = await fetch(cgUrl, { headers: { accept: 'application/json', 'user-agent': 'opensvm-verify/1.0' } });
    const cgJson = await cgRes.json();
    const md = cgJson?.market_data || {};
    report.coingecko = {
      current_price_usd: Number(md?.current_price?.usd ?? NaN),
      market_cap_usd: Number(md?.market_cap?.usd ?? NaN),
      total_volume_usd_24h: Number(md?.total_volume?.usd ?? NaN)
    };

    // Compute deltas (absolute and percent where possible)
    function delta(a, b) {
      if (!Number.isFinite(a) || !Number.isFinite(b)) return { a, b, abs: null, pct: null };
      const abs = a - b;
      const pct = b !== 0 ? (abs / b) * 100 : null;
      return { a, b, abs, pct };
    }

    report.deltas = {
      current_price_usd: delta(report.local.current_price_usd, report.coingecko.current_price_usd),
      market_cap_usd: delta(report.local.market_cap_usd, report.coingecko.market_cap_usd),
      total_volume_usd_24h: delta(report.local.total_volume_usd_24h, report.coingecko.total_volume_usd_24h)
    };

    // Decide ok if all three values are present and within a reasonable tolerance (e.g., 2%) or identical
    const tolPct = 2.0;
    function within(d) {
      if (d.pct === null) return false;
      return Math.abs(d.pct) <= tolPct;
    }
    const allPresent = ['current_price_usd', 'market_cap_usd', 'total_volume_usd_24h'].every(
      k => Number.isFinite(report.local[k]) && Number.isFinite(report.coingecko[k])
    );
    const allClose = allPresent &&
      within(report.deltas.current_price_usd) &&
      within(report.deltas.market_cap_usd) &&
      within(report.deltas.total_volume_usd_24h);

    report.ok = Boolean(allClose);

    fs.writeFileSync('svmai-verify.json', JSON.stringify(report, null, 2));
    console.log('Wrote svmai-verify.json');
  } catch (err) {
    report.error = String(err?.message || err);
    fs.writeFileSync('svmai-verify.json', JSON.stringify(report, null, 2));
    console.error('Verification failed; wrote svmai-verify.json with error');
  }
}

main();

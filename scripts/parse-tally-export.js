/**
 * parse-tally-export.js
 *
 * Parses two Tally XML export files (UTF-16LE encoded) and extracts:
 *   - GROUP elements with name and parent
 *   - LEDGER elements with name, parent, and opening balance
 *   - VOUCHER elements with type, date, party ledger, and ledger entries
 *
 * Outputs a consolidated JSON summary to tally-export-summary.json
 *
 * Usage: node parse-tally-export.js
 */

const fs = require("fs");
const path = require("path");

// ── File paths ──────────────────────────────────────────────────────────────

const FILE_MASTERS = path.join(
  process.env.HOME,
  "Downloads",
  "XML Tally from Ankit.xml"
);
const FILE_TRANSACTIONS = path.join(
  process.env.HOME,
  "Downloads",
  "Transactions.xml"
);
const OUTPUT_PATH = path.join(__dirname, "tally-export-summary.json");

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Read a UTF-16LE file and return clean single-byte text.
 * Tally exports are UTF-16LE, which shows up as every-other-byte being 0x00.
 * After decoding with utf16le, the text is clean — no extra stripping needed.
 * However, we also handle the BOM and any stray null bytes.
 */
function readUtf16File(filePath) {
  const buf = fs.readFileSync(filePath);
  let text = buf.toString("utf16le");
  // Strip BOM if present
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }
  // Remove any stray null bytes (shouldn't happen after utf16le decode, but safety)
  text = text.replace(/\0/g, "");
  return text;
}

/**
 * Extract the text content of a child element within an XML block.
 * Returns null if not found or if the tag is self-closing.
 */
function getChildText(block, tagName) {
  // Self-closing tag: <PARENT/>
  const selfCloseRe = new RegExp(`<${tagName}\\s*/>`, "i");
  if (selfCloseRe.test(block)) {
    return null;
  }
  const re = new RegExp(`<${tagName}>([^<]*)</${tagName}>`, "i");
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

/**
 * Decode XML entities in a string (&amp; -> &, etc.)
 */
function decodeEntities(str) {
  if (!str) return str;
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#4;/g, ""); // Tally uses &#4; as a prefix marker
}

// ── Extraction functions ────────────────────────────────────────────────────

function extractGroups(xml) {
  const groups = [];
  // Match each <GROUP NAME="..."> ... </GROUP> block
  // Use a non-greedy match that stops at </GROUP>
  const re = /<GROUP\s+NAME="([^"]*)"[^>]*>([\s\S]*?)<\/GROUP>/gi;
  let match;
  while ((match = re.exec(xml)) !== null) {
    const name = decodeEntities(match[1].trim());
    const block = match[2];
    const parent = decodeEntities(getChildText(block, "PARENT"));
    groups.push({ name, parent: parent || null });
  }
  return groups;
}

function extractLedgers(xml) {
  const ledgers = [];
  const re = /<LEDGER\s+NAME="([^"]*)"[^>]*>([\s\S]*?)<\/LEDGER>/gi;
  let match;
  while ((match = re.exec(xml)) !== null) {
    const name = decodeEntities(match[1].trim());
    const block = match[2];
    const parent = decodeEntities(getChildText(block, "PARENT"));
    const obRaw = getChildText(block, "OPENINGBALANCE");
    let openingBalance = null;
    if (obRaw) {
      const num = parseFloat(obRaw);
      if (!isNaN(num)) {
        openingBalance = num;
      }
    }
    ledgers.push({ name, parent: parent || null, openingBalance });
  }
  return ledgers;
}

function extractVouchers(xml) {
  const vouchers = [];
  // Match each <VOUCHER ...> ... </VOUCHER> block
  const re =
    /<VOUCHER\s+[^>]*VCHTYPE="([^"]*)"[^>]*>([\s\S]*?)<\/VOUCHER>/gi;
  let match;
  while ((match = re.exec(xml)) !== null) {
    const block = match[2];

    const voucherTypeName =
      decodeEntities(getChildText(block, "VOUCHERTYPENAME")) ||
      decodeEntities(match[1].trim());
    const dateRaw = getChildText(block, "DATE");
    const partyLedgerName = decodeEntities(
      getChildText(block, "PARTYLEDGERNAME")
    );
    const voucherNumber = getChildText(block, "VOUCHERNUMBER");

    // Format date from YYYYMMDD to YYYY-MM-DD
    let date = dateRaw;
    if (dateRaw && dateRaw.length === 8) {
      date = `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`;
    }

    // Extract all ledger entries (ALLLEDGERENTRIES.LIST blocks)
    const entries = [];
    const entryRe =
      /<ALLLEDGERENTRIES\.LIST>([\s\S]*?)<\/ALLLEDGERENTRIES\.LIST>/gi;
    let entryMatch;
    while ((entryMatch = entryRe.exec(block)) !== null) {
      const entryBlock = entryMatch[1];
      const ledgerName = decodeEntities(
        getChildText(entryBlock, "LEDGERNAME")
      );
      const amountRaw = getChildText(entryBlock, "AMOUNT");
      const isDeemedPositive = getChildText(entryBlock, "ISDEEMEDPOSITIVE");
      let amount = null;
      if (amountRaw) {
        const num = parseFloat(amountRaw);
        if (!isNaN(num)) amount = num;
      }
      entries.push({
        ledgerName: ledgerName || null,
        amount,
        isDeemedPositive: isDeemedPositive || null,
      });
    }

    vouchers.push({
      voucherTypeName,
      date,
      partyLedgerName: partyLedgerName || null,
      voucherNumber: voucherNumber || null,
      ledgerEntries: entries,
    });
  }
  return vouchers;
}

// ── Deduplication ───────────────────────────────────────────────────────────

function dedupeGroups(arr) {
  const seen = new Map();
  for (const g of arr) {
    const key = `${g.name}|||${g.parent}`;
    if (!seen.has(key)) {
      seen.set(key, g);
    }
  }
  return [...seen.values()];
}

function dedupeLedgers(arr) {
  const seen = new Map();
  for (const l of arr) {
    const key = `${l.name}|||${l.parent}`;
    // Keep the one with an opening balance if one exists
    if (!seen.has(key)) {
      seen.set(key, l);
    } else if (l.openingBalance !== null && seen.get(key).openingBalance === null) {
      seen.set(key, l);
    }
  }
  return [...seen.values()];
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log("Reading XML files...");

  const xmlMasters = readUtf16File(FILE_MASTERS);
  console.log(`  Masters file: ${(xmlMasters.length / 1024).toFixed(0)} KB of text`);

  const xmlTransactions = readUtf16File(FILE_TRANSACTIONS);
  console.log(
    `  Transactions file: ${(xmlTransactions.length / 1024).toFixed(0)} KB of text`
  );

  // Extract from both files
  console.log("\nExtracting groups...");
  const groups1 = extractGroups(xmlMasters);
  const groups2 = extractGroups(xmlTransactions);
  const allGroups = dedupeGroups([...groups1, ...groups2]);
  console.log(
    `  Found ${groups1.length} in masters, ${groups2.length} in transactions => ${allGroups.length} unique`
  );

  console.log("Extracting ledgers...");
  const ledgers1 = extractLedgers(xmlMasters);
  const ledgers2 = extractLedgers(xmlTransactions);
  const allLedgers = dedupeLedgers([...ledgers1, ...ledgers2]);
  console.log(
    `  Found ${ledgers1.length} in masters, ${ledgers2.length} in transactions => ${allLedgers.length} unique`
  );

  console.log("Extracting vouchers...");
  const vouchers1 = extractVouchers(xmlMasters);
  const vouchers2 = extractVouchers(xmlTransactions);
  const allVouchers = [...vouchers1, ...vouchers2];
  console.log(
    `  Found ${vouchers1.length} in masters, ${vouchers2.length} in transactions => ${allVouchers.length} total`
  );

  // Build summary
  const summary = {
    metadata: {
      generatedAt: new Date().toISOString(),
      sources: [
        { file: "XML Tally from Ankit.xml", groups: groups1.length, ledgers: ledgers1.length, vouchers: vouchers1.length },
        { file: "Transactions.xml", groups: groups2.length, ledgers: ledgers2.length, vouchers: vouchers2.length },
      ],
    },
    groups: allGroups.sort((a, b) => a.name.localeCompare(b.name)),
    ledgers: allLedgers.sort((a, b) => a.name.localeCompare(b.name)),
    vouchers: allVouchers.sort((a, b) => (a.date || "").localeCompare(b.date || "")),
  };

  // Write output
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(summary, null, 2), "utf-8");
  console.log(`\nOutput written to: ${OUTPUT_PATH}`);

  // Print summary stats
  console.log("\n=== SUMMARY ===");
  console.log(`Groups:   ${summary.groups.length}`);
  console.log(`Ledgers:  ${summary.ledgers.length}`);
  console.log(`Vouchers: ${summary.vouchers.length}`);

  // Show group hierarchy
  console.log("\n--- Top-level Groups (no parent) ---");
  const topGroups = summary.groups.filter((g) => !g.parent);
  for (const g of topGroups) {
    console.log(`  ${g.name}`);
    const children = summary.groups.filter((c) => c.parent === g.name);
    for (const c of children) {
      console.log(`    └─ ${c.name}`);
      const grandchildren = summary.groups.filter((gc) => gc.parent === c.name);
      for (const gc of grandchildren) {
        console.log(`       └─ ${gc.name}`);
      }
    }
  }

  // Show voucher type breakdown
  if (summary.vouchers.length > 0) {
    console.log("\n--- Voucher Types ---");
    const typeCounts = {};
    for (const v of summary.vouchers) {
      typeCounts[v.voucherTypeName] = (typeCounts[v.voucherTypeName] || 0) + 1;
    }
    for (const [type, count] of Object.entries(typeCounts).sort(
      (a, b) => b[1] - a[1]
    )) {
      console.log(`  ${type}: ${count}`);
    }
  }

  // Show ledger count by parent group
  console.log("\n--- Ledgers per Parent Group ---");
  const ledgersByParent = {};
  for (const l of summary.ledgers) {
    const p = l.parent || "(no parent)";
    ledgersByParent[p] = (ledgersByParent[p] || 0) + 1;
  }
  for (const [parent, count] of Object.entries(ledgersByParent).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${parent}: ${count}`);
  }
}

main();

const fs = require('fs');

const videosPath = '/mnt/data/Projects/debate-ai.com/lib/debate-data/debate-rounds-videos.json';
const videosData = JSON.parse(fs.readFileSync(videosPath, 'utf8'));

// Regex patterns from most specific to least specific
const patterns = [
  // Rutgers RR 2026 — Round 1 — Kansas OW (AFF) vs. Emory RY (NEG)
  // 2026 Texas Open Octos - Michigan ES vs Georgetown AC
  // [2026] Harvard-Westlake RR Round 5 - Lynbrook OM vs Peninsula SU
  // 2025 Glenbrooks Round 4---Bellarmine CS vs MBA BT
  /^(?:\[.+?\]\s*)?(?<tournament>.+?)\s+[-:–—|│]+\s+(?<round>[^-–:—|│]+?)\s+[-:–—|│]+\s+(?<aff>.+?)\s+vs\.?\s+(?<neg>.+?)$/i,
  
  // Glenbrooks 2025 LD Round 4 │ Harker NB vs. Flintridge Prep IL
  // Yale 2025 LD Semis │ Wheatley AM vs. American Heritage Broward ZC
  /^(?:\[.+?\]\s*)?(?<tournament>.+?)\s+[-:–—|│]\s+(?<aff>.+?)\s+vs\.?\s+(?<neg>.+?)$/i,

  // Shirley Quarters Georgia PR vs Fort Hays RS
  // IrvineRR Round 2 Cal MS vs Towson RK
  // DartmouthRR 2025 Round 4: Kentcuky AM vs Dartmouth BC
  /^(?:\[.+?\]\s*)?(?<tournament>.+?(?:Round \d+|Octas|Quarters|Semis|Finals|Doubles|Octos|RR|Tournament))\s+[-:–—|│]?\s*(?<aff>.+?)\s+vs\.?\s+(?<neg>.+?)$/i,

  // [PF REWIND] University MN vs Bethesda Chevy Chase GT TOC21 Quarters
  // [PF REWIND] Altamont CZ vs Mission San Jose KM ASU Finals
  /^(?:\[.+?\]\s*)?(?<aff>.+?)\s+vs\.?\s+(?<neg>.+?)\s+(?<tournament>.+?)\s+(?<round>Round \d+|Octas|Quarters|Semis|Finals|Doubles|Octos|RR)$/i,

  // Harker LL vs Strake Jesuit MS Blake Round 2
  /^(?:\[.+?\]\s*)?(?<aff>.+?)\s+vs\.?\s+(?<neg>.+?)\s+(?<tournament>.+? (?:Round \d+|Octas|Quarters|Semis|Finals|Doubles|Octos|RR|Tournament).*)$/i,

  // generic: Aff vs Neg fallback
  /^(?:\[.+?\]\s*)?(?<aff>.+?)\s+vs\.?\s+(?<neg>.+?)$/i
];

let parsedCount = 0;
let unparsed = [];

videosData.data = videosData.data.map(item => {
  const title = item[1];
  let tournament = item[7] || null;
  let roundLevel = item[8] || null;
  let affTeam = item[9] || null;
  let negTeam = item[10] || null;

  if (title && (!affTeam || !negTeam)) {
    let matched = false;
    for (const re of patterns) {
      const m = title.match(re);
      if (m && m.groups) {
        if (m.groups.tournament && !tournament) tournament = m.groups.tournament.trim();
        if (m.groups.round && !roundLevel) roundLevel = m.groups.round.trim();
        if (m.groups.aff && !affTeam) affTeam = m.groups.aff.trim();
        if (m.groups.neg && !negTeam) negTeam = m.groups.neg.trim();
        
        // Strip (AFF) and (NEG)
        if (affTeam) affTeam = affTeam.replace(/\s*\(AFF\)$/i, '').trim();
        if (negTeam) negTeam = negTeam.replace(/\s*\(NEG\)$/i, '').trim();

        matched = true;
        break;
      }
    }
    if (!matched) {
      unparsed.push(title);
    } else {
      parsedCount++;
    }
  } else if (affTeam && negTeam) {
    parsedCount++;
  } else {
    unparsed.push(title);
  }

  item[7] = tournament;
  item[8] = roundLevel;
  item[9] = affTeam;
  item[10] = negTeam;
  
  return item;
});

console.log(`Successfully parsed: ${parsedCount} / ${videosData.data.length} (${Math.round(parsedCount/videosData.data.length*100)}%)`);
console.log(`Unparsed examples (out of ${unparsed.length}):`);
console.log(unparsed.slice(0, 20).join('\n'));

fs.writeFileSync(videosPath, JSON.stringify(videosData, null, 2));

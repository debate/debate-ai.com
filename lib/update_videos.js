const fs = require('fs');
const path = require('path');

const videosPath = '/mnt/data/Projects/debate-ai.com/lib/debate-data/debate-rounds-videos.json';
const videosData = JSON.parse(fs.readFileSync(videosPath, 'utf8'));

const re = /^(?<tournament>.+?)\s*[-:–]\s*(?<round>[^-–:]+?)\s*[-:–]\s*(?<aff>.+?)\s+vs\.?\s+(?<neg>.+?)$/i;

videosData.data = videosData.data.map(item => {
  const title = item[1];
  let tournament = null;
  let roundLevel = null;
  let affTeam = null;
  let negTeam = null;

  if (title) {
    const m = title.match(re);
    if (m && m.groups) {
      tournament = m.groups.tournament.trim();
      roundLevel = m.groups.round.trim();
      affTeam = m.groups.aff.trim();
      negTeam = m.groups.neg.trim();
    }
  }

  // Preserve existing fields and just replace/push the newly added ones
  // It has 7 items base.
  item[7] = tournament;
  item[8] = roundLevel;
  item[9] = affTeam;
  item[10] = negTeam;
  
  return item;
});

fs.writeFileSync(videosPath, JSON.stringify(videosData, null, 2));

const fs = require("fs")
const data = require("../../new-videos.json")

const champion = data.filter((v) => v[3] === "Champion Briefs")
const drills = data.filter((v) => v[3] === "DebateDrills")

fs.writeFileSync("new-videos-champion-briefs.json", JSON.stringify(champion, null, 2) + "\n")
fs.writeFileSync("new-videos-debatedrills.json", JSON.stringify(drills, null, 2) + "\n")

console.log(`Champion Briefs: ${champion.length} videos`)
console.log(`DebateDrills: ${drills.length} videos`)

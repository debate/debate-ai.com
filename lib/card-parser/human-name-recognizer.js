const dataHumanNames = {}
// JSON database not loaded in browser - using pattern-based name detection

/**
 * Removes professional qualifications and titles from author names
 * @param {string} authorName - The author name to clean
 * @returns {string} Cleaned author name without qualifications
 */
function cleanProfessionalQualifications(authorName) {
  if (!authorName || typeof authorName !== "string") {
    return authorName
  }

  let cleaned = authorName.trim()

  // Apply each professional pattern to remove qualifications
  for (const pattern of PROFESSIONAL_PATTERNS) {
    cleaned = cleaned.replace(pattern, " ").trim()
  }

  // Clean up extra spaces and punctuation
  cleaned = cleaned
    .replace(/\s+/g, " ")
    .replace(/^[,;.\s]+/, "")
    .replace(/[,;.\s]+$/, "")
    .trim()

  return cleaned
}

/**
 * Parses a full name into its component parts:
 * Title, Firstname, Prefix, Middle, Lastname, Honorific, Alias
 * https://en.wikipedia.org/wiki/List_of_family_name_affixes
 * @param {string} input - The full name to parse.
 * @returns {Object}
 */
const extractHumanNameParts = (input) => {
  // Initialize the result object
  const result = {
    prefix: "", //van der von de
    firstname: "",
    middle: "",
    lastname: "",
    honorific: "", //Jr Phd II
  }

  // Input validation
  if (!input || typeof input !== "string") {
    return result
  }

  // Trim input and determine case fixing mode
  input = input.trim()
  const shouldFixCase = input === input.toUpperCase() || input === input.toLowerCase()

  // Define lists for parsing
  const lists = {
    honorific: ["esq", "esquire", "jr", "sr", "ii", "iii", "iv", "phd", "md", "ms", "mrs", "mr", "miss", "dr"],
    prefix: ["de", "van", "von", "der", "den", "vel", "le", "la", "da"],
    title: ["mr", "mrs", "ms", "miss", "dr", "rev", "prof"],
  }

  // Extract alias
  const aliasRegex = /\s(['']([^'']+)['']|[""]([^""]+)[""]|\[([^\]]+)\]|$$([^$$]+)\)),?\s/g
  const aliasMatch = input.match(aliasRegex)
  if (aliasMatch) {
    input = input.replace(aliasRegex, " ")
  }

  // Split the name into parts
  const parts = input.split(/\s+/)

  // Extract honorific
  const honorificIndex = parts.findIndex((part) => lists.honorific.includes(part.toLowerCase().replace(/\.$/, "")))
  if (honorificIndex !== -1) {
    result.honorific = parts.splice(honorificIndex).join(", ")
  }

  // Extract title
  const titleIndex = parts.findIndex((part) => lists.title.includes(part.toLowerCase().replace(/\.$/, "")))
  if (titleIndex !== -1) {
    result.prefix = parts.splice(titleIndex, 1)[0]
  }

  // Join prefixes to following name parts
  for (let i = parts.length - 2; i >= 0; i--) {
    if (lists.prefix.includes(parts[i]?.toLowerCase())) {
      parts[i] += " " + parts[i + 1]
      parts.splice(i + 1, 1)
    }
  }

  // Extract lastname name (if comma present)
  const commaIndex = parts.findIndex((part) => part.endsWith(","))
  if (commaIndex !== -1) {
    result.lastname = parts
      .splice(0, commaIndex + 1)
      .join(" ")
      .replace(/,$/, "")
  } else {
    result.lastname = parts.pop()
  }

  // Assign remaining parts to firstname and middle names
  if (parts.length > 0) {
    result.firstname = parts.shift()
    if (parts.length > 0) {
      result.middle = parts.join(" ")
    }
  }

  // Fix case if needed
  if (shouldFixCase) {
    Object.keys(result).forEach((key) => {
      if (result[key]) {
        result[key] = result[key]
          .split(" ")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1)?.toLowerCase())
          .join(" ")
      }
    })
  }

  return result
}

/**
 * Validates and formats author names properly handling multiple authors and multi-word names
 *
 * @param {string} author - The author name string(s) to be processed
 * @param {Object} options - Configuration options
 * @returns {Object} Formatted author information for citation
 */
export function extractHumanName(author, options = {}) {
  const { formatCiteShortenAuthor = false, maxAuthorsBeforeEtAl = 2 } = options

  if (!author || !author.split) {
    return { author_cite: "", author_short: "", author_type: 4 }
  }

  // Clean up the input string
  author = author
    .trim()
    .replace(/^by:?\s*/i, "") // Remove "by:" prefix
    .replace(/\s{2,}/g, " ") // Normalize spaces

  // Split into multiple authors if present
  const authorNames = splitMultipleAuthors(author)

  if (authorNames.length === 0) {
    return { author_cite: "", author_short: "", author_type: 4 }
  }

  // Process each author
  const processedAuthors = authorNames.map((authorName) => {
    // Clean professional qualifications from the author name first
    const cleanedAuthorName = cleanProfessionalQualifications(authorName)

    // Check if name is likely an organization
    const isOrg = isOrganization(cleanedAuthorName)

    // Extract name parts using the cleaned name
    const nameParts = extractHumanNameParts(cleanedAuthorName)

    return {
      original: authorName,
      cleaned: cleanedAuthorName,
      nameParts,
      isOrg,
    }
  })

  // Determine overall author type
  let authorType = 0 // Default to unknown/error

  if (processedAuthors.length === 1) {
    authorType = processedAuthors[0].isOrg ? 4 : 1 // 4 = org, 1 = single
  } else if (processedAuthors.length === 2) {
    authorType = 2 // two-author
  } else if (processedAuthors.length > 2) {
    authorType = 3 // more-than-two
  }

  // Format authors for citation
  const formattedAuthors = processedAuthors.map((author) => {
    if (author.isOrg) {
      // Don't reverse organization names
      const maxOrgNameLength = 60
      let orgName = author.cleaned || author.original
      if (orgName.length > maxOrgNameLength) {
        orgName = orgName.substring(0, orgName.slice(0, maxOrgNameLength).lastIndexOf(" "))
      }
      return {
        cite: orgName,
        short: orgName,
      }
    } else {
      // Format human name using name parts
      const nameParts = author.nameParts

      // Handle empty or malformed name parts
      if (!nameParts || !nameParts.lastname) {
        return { cite: author.cleaned || author.original, short: author.cleaned || author.original }
      }

      let formattedFirstName = nameParts.firstname

      // Include middle name with first name if present
      if (nameParts.middle) {
        formattedFirstName += " " + nameParts.middle
      }

      // Add prefix to last name if present
      let lastName = nameParts.lastname
      if (nameParts.prefix) {
        lastName = `${nameParts.prefix} ${lastName}`
      }

      // Shorten first name if option is set
      if (formatCiteShortenAuthor && formattedFirstName) {
        formattedFirstName = formattedFirstName
          .split(/\s+/)
          .map((part) => part[0] + ".")
          .join(" ")
      }

      // Add honorific if present
      let cite = `${lastName}, ${formattedFirstName}`.trim()
      if (nameParts.honorific) {
        cite += `, ${nameParts.honorific}`
      }

      return {
        cite: cite.replace(/,\s*$/, ""),
        short: lastName,
      }
    }
  })

  // Generate citation strings
  let authorCite, authorShort

  if (authorType === 1 || authorType === 4) {
    // Single author or organization
    authorCite = formattedAuthors[0].cite
    authorShort = formattedAuthors[0].short
  } else if (authorType === 2) {
    // Two authors
    authorCite = `${formattedAuthors[0].cite} & ${formattedAuthors[1].cite}`
    authorShort = `${formattedAuthors[0].short} & ${formattedAuthors[1].short}`
  } else if (authorType === 3) {
    // More than two authors
    if (processedAuthors.length <= maxAuthorsBeforeEtAl) {
      // List all authors with commas and "and" before the last one
      const lastAuthor = formattedAuthors.pop()
      authorCite = formattedAuthors.map((a) => a.cite).join(", ")
      if (lastAuthor) {
        authorCite += ` & ${lastAuthor.cite}`
      }
      authorShort = `${formattedAuthors[0].short} et al.`
    } else {
      // Use et al. format
      authorCite = `${formattedAuthors[0].cite} et al.`
      authorShort = `${formattedAuthors[0].short} et al.`
    }
  } else {
    // Unknown/error case (authorType === 0) - use cleaned version if available
    const cleanedAuthor = cleanProfessionalQualifications(author)
    authorCite = cleanedAuthor || author
    authorShort = cleanedAuthor || author
  }

  return {
    author_cite: authorCite,
    author_short: authorShort,
    author_type: authorType,
  }
}

/**
 * Splits a string containing multiple authors into individual author names
 *
 * @param {string} authorString - String potentially containing multiple authors
 * @returns {string[]} Array of individual author names
 */
function splitMultipleAuthors(authorString) {
  if (!authorString) return []

  // Remove "et al." since we're parsing actual authors
  authorString = authorString.replace(/\s+et\s+al\.?/gi, "")

  // Handle common formatting patterns for multiple authors

  // Pattern 1: Last, First & Last, First
  if (/\w+,\s*\w+\s*&\s*\w+,\s*\w+/.test(authorString)) {
    return authorString.split(/\s*&\s*/)
  }

  // Pattern 2: Last, First, Last, First, and Last, First
  if (/\w+,\s*\w+,\s*\w+,\s*\w+/.test(authorString)) {
    // Replace the last comma+and with a standard separator
    authorString = authorString.replace(/,\s*(and|&)\s*(?=[^,]*$)/, " & ")
    return authorString.split(/\s*,\s*(?=[^,]*(?:,|$))/).map((s) => s.trim())
  }

  // Pattern 3: First Last, First Last, and First Last
  if (/\w+\s\w+,\s\w+\s\w+/.test(authorString)) {
    // Replace the last comma+and with a standard separator
    authorString = authorString.replace(/,\s*(and|&)\s*(?=[^,]*$)/, " & ")
    return authorString.split(/\s*,\s*/).map((s) => s.trim())
  }

  // Pattern 4: First Last and First Last
  if (/\w+\s\w+\s(and|&)\s\w+\s\w+/.test(authorString)) {
    return authorString.split(/\s+(and|&)\s+/).map((s) => s.trim())
  }

  // Default pattern - try to split by various separators
  // Replace common author separators with a standard one for easier processing
  authorString = authorString.replace(/\s+and\s+/gi, " & ").replace(/\s*[,;]\s*(?!(?:[^(]*\)))/g, " & ") // Replace commas/semicolons outside parentheses

  // Split by the standard separator
  return authorString.split(/\s*&\s*/).filter((author) => author.trim().length > 0)
}

/**
 * Determines if a name string represents an organization rather than a person
 *
 * @param {string} nameString - The name to analyze
 * @returns {boolean} True if the name appears to be an organization
 */
function isOrganization(nameString) {
  if (!nameString) return false

  // Convert organization terms to array
  const orgTerms = TERMS_ORG.split(",")
  const qualTerms = TERMS_QUALIFICATIONS.split(",")

  // Clean and normalize the name string
  const nameLower = nameString.toLowerCase().replace(/[^\w\s]/g, " ")
  const words = nameLower.split(/\s+/)

  // Check for common organizational acronyms (all caps, 2-6 characters)
  if (/^[A-Z]{2,6}$/.test(nameString.trim())) {
    return true
  }

  // Check for organization terms
  for (const word of words) {
    if (orgTerms.includes(word)) {
      return true
    }
  }

  // Check for qualification terms that suggest it's a person
  for (const word of words) {
    if (qualTerms.includes(word)) {
      return false
    }
  }

  // Look for name patterns that suggest it's a person
  if (/,\s*\w+/.test(nameString)) {
    // Has comma format like "Smith, John"
    return false
  }

  // Check for common organizational patterns
  const orgPatterns = [
    /\b(inc|ltd|llc|corp|corporation|company|co\.?|group|associates|partners|consulting|services|solutions|systems|technologies|international|global|worldwide|national|federal|state|local|department|ministry|agency|bureau|office|commission|committee|council|board|institute|foundation|center|centre|organization|association|society|union|federation|alliance|coalition)\b/i,
    /\b(united|american|british|canadian|european|international|world|global|national|federal|state|local)\s+(states|kingdom|nations|organization|union|federation|government|department|ministry|agency|bureau|office|commission|committee|council|board|institute|foundation|center|centre|association|society)\b/i,
    /\b(intergovernmental|governmental|non-governmental|nonprofit|non-profit|charitable|philanthropic|educational|academic|research|scientific|technical|professional|commercial|business|corporate|industrial|financial|economic|political|social|cultural|environmental|climate|energy|security|military|defense|foreign|international|public|health|medical|legal|data|computer|software|artificial|intelligence|ai)\s+(panel|committee|commission|council|board|institute|foundation|center|centre|organization|association|society|union|federation|alliance|coalition|partnership|collaboration|cooperation|joint|shared|common|public|private|ngo|charity|philanthropic|educational|academic|scholarly|scientific|technical|professional|commercial|business|corporate|industrial|financial|economic|political|social|cultural|environmental|climate|energy|security|military|defense|foreign|international|public|health|medical|legal|data|computer|software|artificial|intelligence|ai)\b/i,
  ]

  for (const pattern of orgPatterns) {
    if (pattern.test(nameString)) {
      return true
    }
  }

  // If there are more than 4 words and no commas, it's likely an organization
  if (words.length > 4 && !nameString.includes(",")) {
    return true
  }

  // Check if the name contains any human name parts according to our database
  let hasHumanNamePart = false
  for (const word of words) {
    const nameTitle = word[0]?.toUpperCase() + word.slice(1)?.toLowerCase()
    if (dataHumanNames[nameTitle] === 1 || dataHumanNames[nameTitle] === 2) {
      hasHumanNamePart = true
      break
    }
  }

  // If no human name parts found and more than 2 words, likely an organization
  return !hasHumanNamePart && words.length > 2
}

// Common organization terms for detection - extended list from provided code
const TERMS_ORG =
  "abc,ag,ap,academy,advisors,agency,airbnb,amazon,america,american,apple,associated,association,atlantic," +
  "attorneys,authority,axel,bank,baptiste,bbc,bertelsmann,blackrock,bloomberg,bmw,boston,broadcasting,bureau," +
  "business,buzzfeed,cambridge,capital,cbs,center,chase,chicago,china,church,citigroup,clinic,club,cnn,coca-cola," +
  "college,commission,communications,condé,consulting,corp,corps,costco,daily,department,der,deutsche,division,dow," +
  "economist,enterprises,eu,european,fabrication,facebook,fargo,ferrari,financial,ford,forbes,fox,france,fund," +
  "gannett,general,global,globe,gm,gmbh,goldman,google,group,guardian,harvard,hearst,herald,hill,holdings,home," +
  "honda,hospital,huffington,ibm,inc,industries,institute,intel,international,investments,jazeera,japan,jones," +
  "jpmorgan,lancet,laboratories,law,legal,linkedin,llc,los,ltd,manufacturing,macy's,mcdonald's,media,medical," +
  "mercedes-benz,meta,microsoft,ministry,mit,morgan,mosque,msnbc,nast,national,nato,nbc,netflix,news,newsweek," +
  "new,nike,nordstrom,npr,ny,organization,oxford,país,partners,pbs,pentagon,plc,politico,porsche,post,press," +
  "productions,r&d,regiment,retail,reuters,research,rt,sachs,school,science,scientific,solutions,south,spacex,spiegel," +
  "springer,stanford,stanley,starbucks,straits,studios,sydney,synagogue,systems,target,team,tech,techcrunch,temple," +
  "tesla,the,thomson,times,toronto,toyota,trust,twitter,uber,union,united,university,usa,valley,vanguard,vice," +
  "volkswagen,volvo,vox,wall,walmart,welle,wells,who,white,wired,worldwide,works,world,wsj,york,yorker," +
  // Additional organizational acronyms and names
  "ipcc,un,unep,undp,unicef,who,wto,imf,world,bank,oecd,cia,fbi,nsa,epa,fda,cdc,nih,nasa,noaa,usgs,doe,dod," +
  "state,department,treasury,commerce,labor,education,energy,interior,agriculture,transportation,housing," +
  "urban,development,veterans,affairs,homeland,security,justice,defense,health,human,services," +
  "congressional,budget,office,cbo,government,accountability,office,gao,office,management,budget,omb," +
  "federal,reserve,fed,securities,exchange,commission,sec,federal,trade,commission,ftc," +
  "national,academy,sciences,nas,american,association,advancement,science,aaas," +
  "brookings,institution,heritage,foundation,cato,institute,aei,american,enterprise,institute," +
  "rand,corporation,center,strategic,international,studies,csis,peterson,institute,international,economics," +
  "council,foreign,relations,cfr,atlantic,council,center,new,american,security,cnas," +
  "international,monetary,fund,world,trade,organization,organization,petroleum,exporting,countries,opec," +
  "north,atlantic,treaty,organization,nato,european,union,african,union,asean,association,southeast,asian,nations," +
  "g7,g8,g20,group,seven,eight,twenty,united,nations,security,council,general,assembly," +
  "international,court,justice,icj,international,criminal,court,icc,world,health,organization," +
  "international,labor,organization,ilo,food,agriculture,organization,fao,unesco,united,nations,educational," +
  "scientific,cultural,organization,international,telecommunication,union,itu,world,meteorological,organization,wmo," +
  "international,maritime,organization,imo,international,civil,aviation,organization,icao," +
  "international,atomic,energy,agency,iaea,organization,prohibition,chemical,weapons,opcw," +
  "comprehensive,nuclear,test,ban,treaty,organization,ctbto,preparatory,commission"

// Qualification terms that might suggest the name belongs to a person rather than an organization
const TERMS_QUALIFICATIONS =
  "is,senior,associate,professor,fellow,assistant,lecturer,ceo,staff,strategist,specialist,worked,directed," +
  "correspondent,president,author,director,prof,asst,editor,analyst,degree,administrator,served,member," +
  "institute,economist,reporter,head,heads,newspaper,deputy,advocate,colonel,officer,founder,founded,visiting," +
  "journalist,former,retired,expert,executive,manager,doctoral,candidate,chief,contributor,student,blogger," +
  "chair,chairman,major,general,ambassador,phd,secretary,physicist,engineer,research,office,school,department," +
  "writer,teacher,advisor,award,center,commentator,rand,brookings,heritage,cato,un,aei,forbes,nyt,cbo"

// Professional qualification patterns to remove from author names
const PROFESSIONAL_PATTERNS = [
  // Common professional titles and qualifications
  /\b(professor|prof|dr|doctor|phd|md|ms|mrs|mr|miss)\b\.?\s*/gi,
  /\b(senior|associate|assistant|visiting|emeritus|distinguished)\s+(professor|fellow|lecturer|researcher|scientist|analyst|director|editor|writer|author|correspondent|reporter|journalist)\b\.?\s*/gi,
  /\b(political|economic|social|environmental|climate|energy|security|military|defense|foreign|international|public|health|medical|legal|business|financial|data|computer|software|artificial|intelligence|ai)\s+(scientist|analyst|expert|specialist|researcher|scholar|fellow|consultant|advisor|director|manager|officer|correspondent|reporter|journalist|writer|author|editor|commentator|blogger)\b\.?\s*/gi,
  /\b(norwegian|american|british|canadian|german|french|chinese|japanese|russian|indian|brazilian|australian|european|asian|african|latin|middle|eastern|western|northern|southern)\s+(political|economic|social|environmental|climate|energy|security|military|defense|foreign|international|public|health|medical|legal|business|financial|data|computer|software|artificial|intelligence|ai)\s+(scientist|analyst|expert|specialist|researcher|scholar|fellow|consultant|advisor|director|manager|officer|correspondent|reporter|journalist|writer|author|editor|commentator|blogger)\b\.?\s*/gi,
  /\b(worked|served|directed|founded|established|created|developed|designed|built|managed|led|headed|chaired|presided|authored|wrote|published|edited|reported|covered|analyzed|studied|researched|investigated|examined|evaluated|assessed|reviewed|critiqued|commented|blogged|tweeted|posted)\b\.?\s*/gi,
  /\b(at|in|for|with|from|to|of|the|a|an)\s+(university|college|institute|institution|organization|company|corporation|agency|department|ministry|government|congress|parliament|senate|house|assembly|council|board|committee|commission|foundation|center|centre|lab|laboratory|research|think|tank|policy|strategy|consulting|advisory|media|news|press|publication|journal|magazine|newspaper|website|blog|podcast|tv|television|radio|broadcast|network|channel|station|service|bureau|office|headquarters|hq|main|central|regional|local|national|international|global|worldwide|federal|state|provincial|municipal|city|town|village|community|society|association|union|federation|alliance|partnership|collaboration|cooperation|joint|shared|common|public|private|non-profit|nonprofit|ngo|charity|philanthropic|educational|academic|scholarly|scientific|technical|professional|commercial|business|corporate|industrial|financial|economic|political|social|cultural|environmental|climate|energy|security|military|defense|foreign|international|public|health|medical|legal|business|financial|data|computer|software|artificial|intelligence|ai)\b\.?\s*/gi,
  // Remove everything after common separators that indicate qualifications
  /[,;]\s*[^,;]*$/,
  /\s+&\s+[^&]*$/,
  /\s+and\s+[^and]*$/i,
  // Specific pattern for "Name & Qualification" format
  /\s+&\s+[^&]*$/,
  // Pattern for "Name, Qualification" format
  /,\s*[^,]*$/,
  // Pattern for "Name Qualification" format (no separator)
  /\s+(political|economic|social|environmental|climate|energy|security|military|defense|foreign|international|public|health|medical|legal|business|financial|data|computer|software|artificial|intelligence|ai)\s+(scientist|analyst|expert|specialist|researcher|scholar|fellow|consultant|advisor|director|manager|officer|correspondent|reporter|journalist|writer|author|editor|commentator|blogger)\b.*$/gi,
]

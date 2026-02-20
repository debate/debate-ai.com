import { type NextRequest, NextResponse } from "next/server"

const DEMO_DATA = [
  {
    id: 1,
    category: "DA",
    researchField: "Climate",
    argBlock: "A2: Food Security...Adaptation Fails...Economy",
    summary:
      "Climate change poses significant risks to global food security through altered precipitation patterns and increased temperature extremes.",
    cite_short: "Smith et al. 2023",
    cite: "Smith, J., Johnson, M., & Williams, R. (2023). Global Food Security and Climate Change. Journal of Environmental Studies, 45(3), 234-256.",
    readCount: 127,
    highlightLength: 1420,
    textLength: 8950,
    word_count: 1520,
    html: "<p>Climate change represents one of the most <mark>significant challenges</mark> facing humanity in the 21st century. <u>Rising global temperatures</u> have led to unprecedented changes in weather patterns, affecting agricultural productivity worldwide.</p><p>Studies indicate that crop yields could decline by up to 30% in some regions by 2050 if current trends continue. The implications for food security are profound, particularly in developing nations where agriculture forms the backbone of the economy.</p><p>Adaptation strategies must include investment in drought-resistant crops, improved irrigation systems, and sustainable farming practices. International cooperation will be essential to address this global challenge effectively.</p>",
    tag: "climate change, food security",
    year: "23",
    page: "234",
  },
  {
    id: 2,
    category: "DA",
    researchField: "Oil",
    argBlock: "A2: Warming Turns...Impacts...Hegemony",
    summary:
      "Artificial intelligence systems demonstrate remarkable capabilities in natural language processing but raise important questions about bias and transparency.",
    cite_short: "Chen & Rodriguez 2024",
    cite: "Chen, L., & Rodriguez, A. (2024). Ethical Considerations in AI Development. ACM Computing Reviews, 58(2), 112-145.",
    readCount: 213,
    highlightLength: 2100,
    textLength: 12400,
    word_count: 2150,
    html: "<p><mark>Artificial intelligence</mark> has made tremendous strides in recent years, particularly in the domain of natural language processing. Systems like GPT-4 and Claude demonstrate sophisticated understanding of context and nuance.</p><p>However, these advances come with significant ethical considerations. <u>Bias in training data</u> can lead to discriminatory outcomes, while the lack of transparency in decision-making processes raises accountability concerns.</p><p>Researchers advocate for comprehensive AI governance frameworks that prioritize fairness, transparency, and human oversight. The development of explainable AI systems remains a critical priority for the field.</p>",
    tag: "artificial intelligence, ethics",
    year: "24",
    page: "112",
  },
  {
    id: 3,
    category: "CP",
    researchField: "Renewables",
    argBlock: "1AC: Solvency...Cost Parity...Storage Tech",
    summary:
      "Renewable energy technologies have achieved cost parity with fossil fuels in many markets, accelerating the global energy transition.",
    cite_short: "Thompson 2023",
    cite: "Thompson, K. (2023). Economic Analysis of Renewable Energy Adoption. Energy Policy Journal, 167, 445-478.",
    readCount: 189,
    highlightLength: 1850,
    textLength: 10200,
    word_count: 1780,
    html: "<p>The cost of <mark>solar and wind energy</mark> has declined dramatically over the past decade, making renewables competitive with traditional fossil fuels. In many regions, new renewable installations are now cheaper than maintaining existing coal plants.</p><p><u>Battery storage technology</u> has emerged as a crucial enabler of renewable energy integration, addressing the intermittency challenges that previously limited adoption.</p><p>Policy support, technological innovation, and economies of scale have combined to create a self-reinforcing cycle of cost reduction and deployment. The trajectory suggests that renewables will dominate new power generation capacity in the coming decades.</p>",
    tag: "renewable energy, economics",
    year: "23",
    page: "445",
  },
  {
    id: 4,
    category: "K",
    researchField: "Capitalism",
    argBlock: "Link: Commodity Logic...Alt: Reject Aff...Framework",
    summary:
      "Capitalist structures perpetuate inequality through the commodification of labor and extraction of surplus value from workers.",
    cite_short: "Martinez 2022",
    cite: "Martinez, S. (2022). Contemporary Critiques of Capital Accumulation. Critical Theory Review, 34(1), 78-112.",
    readCount: 1250,
    highlightLength: 3200,
    textLength: 15800,
    word_count: 2850,
    html: "<p>The <mark>fundamental contradiction of capitalism</mark> lies in its relentless drive for accumulation at the expense of human dignity. <u>Labor becomes merely a commodity</u> to be bought and sold, divorced from its creative and social dimensions.</p><p>This alienation manifests in multiple forms: workers are estranged from the products they create, from the act of production itself, and ultimately from their own humanity. The system's logic reduces all value to exchange value, erasing the qualitative richness of human experience.</p><p>Resistance requires not mere reform but a fundamental reimagining of economic relations. We must reject the framework that treats human potential as a resource to be exploited.</p>",
    tag: "capitalism, critique, labor",
    year: "22",
    page: "78",
  },
  {
    id: 5,
    category: "I",
    researchField: "Nuclear War",
    argBlock: "Impact: Extinction...Nuclear Winter...Timeframe",
    summary:
      "Nuclear conflict between major powers would result in catastrophic humanitarian consequences and potential extinction-level threats to civilization.",
    cite_short: "Park & Wilson 2023",
    cite: "Park, J., & Wilson, D. (2023). Modern Nuclear Arsenals and Global Security Risks. International Security Quarterly, 89(4), 567-603.",
    readCount: 842,
    highlightLength: 2890,
    textLength: 14200,
    word_count: 2650,
    html: "<p>A nuclear exchange between the United States and Russia would immediately kill <mark>hundreds of millions of people</mark> through blast effects, radiation, and thermal burns. But the immediate casualties represent only the beginning of the catastrophe.</p><p><u>Nuclear winter scenarios</u> predict that smoke and soot injected into the stratosphere would block sunlight for years, causing global temperature drops of 15-25 degrees Celsius. Agricultural collapse would follow, leading to mass starvation across remaining populations.</p><p>The risk of accidental or unauthorized launch remains unacceptably high. Modernization programs increase the danger by introducing new vulnerabilities and reducing decision-making time. Immediate action is required to reduce arsenals and improve communication protocols.</p>",
    tag: "nuclear weapons, extinction, security",
    year: "23",
    page: "567",
  },
  {
    id: 6,
    category: "T",
    researchField: "Topicality",
    argBlock: "Violation...Interpretation...Standards...Voters",
    summary:
      "The affirmative plan fails to meet the topic's core requirement of substantially increasing federal investment in domestic infrastructure.",
    cite_short: "Webster's Dictionary 2024",
    cite: "Webster's New Collegiate Dictionary (2024). 'Substantial' definition and usage.",
    readCount: 45,
    highlightLength: 850,
    textLength: 3200,
    word_count: 580,
    html: "<p>The term <mark>'substantially'</mark> requires a significant increase in magnitude, not merely a token gesture. Dictionary definitions consistently support this interpretation across legal and common usage contexts.</p><p><u>Ground and limits</u> are essential to fair debate. Allowing marginal increases as 'substantial' explodes the topic and eliminates predictable negative ground. The affirmative must meet a threshold of significance to justify topicality.</p>",
    tag: "topicality, standards, definitions",
    year: "24",
    page: "452",
  },
  {
    id: 7,
    category: "CP",
    researchField: "Federal Courts",
    argBlock: "Text...Competition...Net Benefit: Politics",
    summary:
      "Federal courts can resolve constitutional questions more effectively than legislative action while avoiding political backlash.",
    cite_short: "Anderson 2023",
    cite: "Anderson, M. (2023). Judicial Review and Policy Innovation. Yale Law Journal, 128(6), 1823-1867.",
    readCount: 567,
    highlightLength: 2340,
    textLength: 11500,
    word_count: 2100,
    html: "<p><mark>Judicial resolution</mark> of contentious policy questions offers several advantages over legislative approaches. Courts can act more quickly, address constitutional dimensions directly, and insulate reforms from immediate political reprisal.</p><p>The countermajoritarian difficulty is overstated. <u>Courts derive legitimacy</u> from their deliberative process and constitutional grounding, not from electoral validation. Strategic litigation can achieve policy changes that legislative gridlock makes impossible.</p><p>Net benefits include avoiding the political capital costs that derail congressional initiatives. Presidential political capital is finite and better preserved for other priorities where judicial action cannot substitute.</p>",
    tag: "courts, litigation, politics",
    year: "23",
    page: "1823",
  },
  {
    id: 8,
    category: "DA",
    researchField: "Economy",
    argBlock: "Link: Federal Spending...Internal: Debt...Impact: Collapse",
    summary:
      "Increased federal spending exacerbates debt burdens, risking economic collapse through currency devaluation and loss of investor confidence.",
    cite_short: "Roberts & Lee 2024",
    cite: "Roberts, T., & Lee, K. (2024). Fiscal Sustainability and Economic Stability. American Economic Review, 114(3), 445-489.",
    readCount: 1580,
    highlightLength: 4100,
    textLength: 18200,
    word_count: 3200,
    html: "<p>The <mark>federal debt trajectory</mark> poses systemic risks to American economic stability. Current deficit spending is unsustainable, with debt-to-GDP ratios approaching historical highs reached only during major wars.</p><p><u>Credit markets will eventually demand higher yields</u> to compensate for sovereign risk, triggering a debt spiral. Interest costs already consume a growing share of federal revenues, crowding out essential government functions and investments.</p><p>A fiscal crisis would devastate the global economy. The dollar's reserve currency status provides temporary insulation but cannot protect indefinitely against fundamental insolvency. Immediate fiscal consolidation is imperative to prevent catastrophic adjustment.</p>",
    tag: "economy, debt, fiscal policy",
    year: "24",
    page: "445",
  },
  {
    id: 9,
    category: "K",
    researchField: "Biopower",
    argBlock: "Link: State Regulation...Alt: Resistance...ROB",
    summary:
      "Biopolitical control operates through the management of populations, rendering bodies docile and productive for state interests.",
    cite_short: "Foucault & Kim 2021",
    cite: "Kim, Y. (2021). Biopolitics in the 21st Century: Foucault Revisited. Continental Philosophy Review, 54(2), 234-278.",
    readCount: 320,
    highlightLength: 1950,
    textLength: 9800,
    word_count: 1650,
    html: "<p><mark>Biopower functions through normalization</mark> rather than prohibition. The state disciplines bodies not through direct coercion but by establishing norms of health, productivity, and proper conduct that individuals internalize and self-police.</p><p><u>Regulatory mechanisms</u> mask political choices as scientific or medical necessities. Public health becomes a vector for control, defining acceptable and unacceptable forms of life under the guise of neutral expertise.</p><p>Resistance must target the biopolitical apparatus itself. We cannot accept the terms of debate that reduce human existence to biological optimization. The alternative begins with refusal of the normalizing gaze.</p>",
    tag: "biopower, Foucault, resistance",
    year: "21",
    page: "234",
  },
  {
    id: 10,
    category: "I",
    researchField: "Climate Tipping Points",
    argBlock: "Impact: Irreversible Warming...Feedback Loops...Magnitude",
    summary:
      "Crossing critical climate thresholds will trigger irreversible feedback loops, causing runaway warming incompatible with human civilization.",
    cite_short: "IPCC 2023",
    cite: "IPCC Special Report (2023). Climate Tipping Points and Irreversible Change. Cambridge University Press, pp. 89-156.",
    readCount: 2100,
    highlightLength: 5200,
    textLength: 22400,
    word_count: 4100,
    html: "<p>The climate system contains multiple <mark>tipping points</mark> that, once crossed, initiate self-reinforcing warming cycles. These include permafrost methane release, Amazon rainforest dieback, and collapse of major ice sheets.</p><p><u>Current emission trajectories</u> place us on course to cross several thresholds within decades. Each tipping point amplifies warming, potentially triggering cascading failures across Earth systems. The resulting hothouse scenario would render large portions of the planet uninhabitable.</p><p>Temperature increases of 4-6 degrees Celsius would cause agricultural collapse, mass displacement of billions of people, and breakdown of global trade and governance systems. The window for prevention is rapidly closing. Immediate, dramatic emissions reductions are the only pathway to avoid catastrophe.</p>",
    tag: "climate change, tipping points, extinction",
    year: "23",
    page: "89",
  },
  {
    id: 11,
    category: "CP",
    researchField: "States",
    argBlock: "Text: 50 State Action...Competition...NB: Federalism",
    summary:
      "State-level policy implementation preserves federalism benefits including experimentation, local tailoring, and resilience through redundancy.",
    cite_short: "Brown 2022",
    cite: "Brown, A. (2022). The New Federalism: State Innovation in Policy Design. Stanford Law Review, 74(5), 1234-1289.",
    readCount: 95,
    highlightLength: 1120,
    textLength: 5400,
    word_count: 920,
    html: "<p><mark>Federalism's laboratory of democracy</mark> allows states to experiment with different policy approaches, providing valuable information about effectiveness before national adoption. States can tailor solutions to local conditions and preferences.</p><p><u>Decentralization enhances resilience</u> by preventing single points of failure. When federal initiatives stall or fail, state action provides backup capacity. Competition between states drives innovation and efficiency improvements.</p><p>The net benefit is preservation of constitutional structure and political accountability. Citizens can more effectively influence state governments, and policy diversity better reflects democratic pluralism.</p>",
    tag: "federalism, states, policy",
    year: "22",
    page: "1234",
  },
  {
    id: 12,
    category: "T",
    researchField: "Increase",
    argBlock: "Violation: Not Increase...Interpretation...Voters",
    summary:
      "The affirmative plan merely maintains existing funding levels rather than increasing investment as required by the resolution.",
    cite_short: "Black's Law Dictionary 2024",
    cite: "Black's Law Dictionary (2024). 11th Edition. 'Increase' definition.",
    readCount: 78,
    highlightLength: 720,
    textLength: 2800,
    word_count: 480,
    html: "<p>The verb <mark>'increase'</mark> unambiguously means to make greater in quantity, not to maintain or redistribute. Legal and common usage consistently support this interpretation.</p><p><u>Limits are essential for fair debate</u>. Allowing maintenance or reallocation as 'increase' makes the topic impossibly broad, eliminating core negative ground and making preparation unworkable. The affirmative must actually augment total investment.</p>",
    tag: "topicality, definitions, increase",
    year: "24",
    page: "789",
  },
]

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const sortBy = searchParams.get("sort") || "_text_match:desc"
  const query = searchParams.get("q") || ""

  // Clone the data to avoid mutation
  let results = [...DEMO_DATA]

  // Apply search filter if query exists
  if (query) {
    const lowerQuery = query.toLowerCase()
    results = results.filter(
      (item) =>
        item.summary.toLowerCase().includes(lowerQuery) ||
        item.researchField.toLowerCase().includes(lowerQuery) ||
        item.tag.toLowerCase().includes(lowerQuery) ||
        item.argBlock.toLowerCase().includes(lowerQuery),
    )
  }

  // Apply sorting
  const [field, order] = sortBy.split(":")

  results.sort((a, b) => {
    let aVal: any
    let bVal: any

    switch (field) {
      case "readCount":
        aVal = a.readCount
        bVal = b.readCount
        break
      case "year":
        aVal = Number.parseInt(a.year)
        bVal = Number.parseInt(b.year)
        break
      case "highlightLength":
        aVal = a.highlightLength
        bVal = b.highlightLength
        break
      case "_text_match":
      default:
        // For relevance, maintain original order
        return 0
    }

    if (order === "asc") {
      return aVal - bVal
    } else {
      return bVal - aVal
    }
  })

  return NextResponse.json({ results, total: results.length })
}

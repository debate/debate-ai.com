<p align="center">
    <img src="https://i.imgur.com/J0XD0IN.png"  width="400px" />
</p>
<p align="center">
    <!-- <img alt="GitHub Stars" src="https://img.shields.io/github/stars/vtempest/debate-docx-to-args" />
    <a href="https://github.com/vtempest/debate-docx-to-args/discussions">
    <img alt="GitHub Discussions"
        src="https://img.shields.io/github/discussions/vtempest/debate-docx-to-args" />
    </a> -->
     <a href="https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request">
            <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome" />
    </a>
    <a href="https://codespaces.new/vtempest/debate-docx-to-args">
    <img src="https://github.com/codespaces/badge.svg" width="150" height="20" />
    </a>
</p>


# Debate DOCX to ARGS: Annotated Research Graph Summaries

Node.js tool for converting DOCX files into structured debate cards with rich metadata extraction and analysis, designed to build consensus on research claims. 
It transforms debate research documents (DOCX) into structured JSON, capturing citations, highlights, word counts, and error tracking, while preserving the hierarchical structure of debate briefs. Key metadata is extracted for LLM analysis, enabling LLMs to review the full text, identify logic flaws or unsupported claims, and flag overstatements. LLMs also extend warrants, summarize support, and suggest where each card fits within the Topic Research Unified Tree Hierarchy (TRUTH). The system is built for intersubjective, consensus-driven research claim to find ground truth on issues and evaluate any claim's proximity to accepted truths and human values. This can reduce LLM hallucination and steer alignment with common social values as AI gains capacity to replace human  leaders of organizations. Annotated Research Graph Summaries on the overall TRUTH can build GOD: Governance via Online Debate.

## Algorithm: Step-by-Step Conversion Process

### Phase 1: DOCX to Structured Cards
1. **Document Parsing**
   - Preserves original formatting, styles, and structure
   - Maintains bold text, underlines, highlights, and paragraph breaks

2. **HTML Structure Preservation**
   - Converts Word styles to HTML tags (`<b>`, `<u>`, `<mark>`, `<p>`, `<h1-h4>`)
   - Preserves nested formatting and complex styling
   - Maintains document hierarchy through heading tags

3. **HTML Parsing with htmlparser2**
   - Uses streaming HTML parser to process large documents efficiently
   - Tracks element stack and current context (section, subsection, block, card)
   - Maintains state for heading types, paragraphs, and bold text

4. **Hierarchical Structure Detection**
   - **H1 tags**: Section headings (e.g., "5G Innovation")
   - **H2 tags**: Subsection headings (e.g., "1NC---5G Plank") 
   - **H3 tags**: Block headings (e.g., "Counterplan Details")
   - **H4 tags**: Card summaries (e.g., "The CP solves 5G innovation")

5. **Card Content Extraction**
   - **Citation Detection**: Identifies paragraphs with bold text as citations
   - **Author Extraction**: Advanced author name processing with human names recognition:
     - **Standard Format**: "Smith '23" → author: "Smith", author_type: 1, year: 2023
     - **Multiple Authors**: "Wallace & Gromit" → author: "Wallace & Gromit", author_type: 2
     - **Organizational Authors**: "IPCC" → author: "IPCC", author_type: 4
     - **Quote-only**: "'23" → searches full citation for name before quote
     - **Professional Qualifications**: "Breines & Norwegian Political Scientist" → author: "Breines", author_type: 2
   - **Author Type Classification**:
     - `0` = Unknown/error case
     - `1` = Single human author
     - `2` = Two authors (e.g., "Smith & Jones")
     - `3` = More than two authors (uses "et al." format)
     - `4` = Organization (e.g., "IPCC", "UN", "Brookings")
   - **Year Processing**: Multiple extraction methods:
     - 4-digit years: 2023, 1999
     - 2-digit years: '23 → 2023, '99 → 1999
     - Fallback: 1-2 digit numbers in first 5 words of citation
   - **URL Extraction**: Finds HTTP/HTTPS links in citations
   - **Content Assembly**: Joins paragraph content into card body

6. **Text Highlighting Extraction**
   - **Marked Text**: Extracts content within `<mark>` tags
   - **Underlined Text**: Extracts content within `<u>` tags (optional)
   - **Joining**: Combines highlights with ellipsis ("…") or spaces

7. **Word Counting**
   - **Total Words**: Strips HTML tags, normalizes whitespace, counts words
   - **Highlighted Words**: Counts words in marked text (replacing ellipsis with spaces)
   - **Clean Text Processing**: Removes HTML entities and collapses whitespace

8. **Error Detection and Validation**
   - **Missing Fields**: Tracks missing summary, citation, author, year, URL
   - **Invalid Data**: Detects invalid years, malformed URLs
   - **Content Issues**: Identifies empty content, missing highlights
   - **Format Problems**: Flags non-breaking spaces, nested HTML tags
   - **Error Array**: Each card gets an `error` field with descriptive codes

### Phase 2: Metadata Assembly

9. **File Information Extraction**
   - **Filename Parsing**: Extracts category, topic, organization, year from filename
   - **Example**: "Aff - Military Capacity - CNDI 2025.html"
     - category: "Aff"
     - topic: "Military Capacity" 
     - organization: "CNDI"
     - year: 2025

10. **Statistics Generation**
    - **Card Count**: Total number of debate cards extracted
    - **Block Count**: Number of H3 block headings
    - **Quote Count**: Number of cards with citations
    - **Metadata Object**: Summary statistics for the document

### Phase 3: Human Names Recognition System (`human-name-recognizer.js`)

11. **Advanced Author Processing**
    - **92K Human Names Database**: Validates author names against comprehensive database of human names
    - **Professional Qualification Filtering**: Removes titles and qualifications from author names:
      - "Dr. Smith" → "Smith"
      - "Professor Johnson" → "Johnson" 
      - "Breines & Norwegian Political Scientist" → "Breines"
    - **Organization Detection**: Identifies organizational authors using multiple strategies:
      - **Acronym Recognition**: IPCC, UN, WHO, NATO, etc.
      - **Government Agencies**: EPA, FDA, CDC, NASA, etc.
      - **Think Tanks**: Brookings, Heritage, Cato, AEI, etc.
      - **International Organizations**: UN, EU, G7, G20, etc.
      - **Pattern Matching**: Detects organizational suffixes (Inc, Ltd, Corp, etc.)

12. **Multiple Author Handling**
    - **Author Splitting**: Intelligently separates multiple authors:
      - "Smith & Jones" → ["Smith", "Jones"]
      - "Smith, Jones, and Brown" → ["Smith", "Jones", "Brown"]
      - "Smith, Jones & Brown" → ["Smith", "Jones", "Brown"]
    - **Citation Formatting**: Formats citations based on author count:
      - Single: "Smith, John"
      - Two: "Smith, John & Jones, Jane"
      - Multiple: "Smith, John et al."

### Phase 4: Output Structure

13. **JSON Structure Creation**
    ```json
    {
      "metadata": {
        "category": "Aff",
        "title": "Military Capacity",
        "organization": "CNDI", 
        "year": 2025,
        "quotes": 147,
        "blocks": 73
      },
      "outline": [
        {
          "type": 1,
          "text": "Section Heading"
        },
        {
          "type": 2, 
          "text": "Subsection Heading"
        },
        {
          "type": 3,
          "text": "Block Heading"
        },
             "summary": "NATO collapse when Canada invokes Article V causes Extinction.",
      "author": "Benson",
      "author_type": 1,
      "cite": "Benson 24, DPhil political science and government, senior policy analyst for National Security and International Policy @ American Progress. (Robert, 3-26-2024, \"In Defense of NATO: Why the Trans-Atlantic Alliance Matters,\" Center for American Progress, https://www.americanprogress.org/article/in-defense-of-nato-why-the-trans-atlantic-alliance-matters/)",
      "year": 2024,
      "url": "https://www.americanprogress.org/article/in-defense-of-nato-why-the-trans-atlantic-alliance-matters/",
      "html": "<p><u>NATO is an <b>engine of</b></u> post-war <u><b>peace</b></u></p>\n<p><mark>NATO</mark> has <mark>helped</mark> to <b><mark>avert</mark></b> the <b>enormous costs</b>—both human and economic—<u>of a <b><mark>large</mark>-scale <mark>war</mark></b> by fostering a <b>climate of security</b> and predictability</u>. Indeed, Europe has enjoyed an era of peace and stability unprecedented in its history in the decades following World War II. Much of this success owes to <u>NATO’s</u> effective <u>strategy of <b><mark>collective defense</mark></b></u>, which <u><b><mark>deters</mark></b>....",
      "words": 566,
      "wordsMarked": 51
    },
      ]
    }
    ```

## Usage

### Command Line Interface
```bash
# Process single file
node src/docx-to-html-cli.js input.docx

# Process directory of files
node src/process-cards-files.js /path/to/html/files
```

### Programmatic Usage
```javascript
import { htmlToCards } from './src/html-to-cards.js'
import { convertDocxToHTML } from './src/docx-to-html.js'

// Convert DOCX to HTML
const html = await convertDocxToHTML(docxBuffer)

// Convert HTML to structured cards
const result = htmlToCards(html, 'filename.docx')
console.log(`Extracted ${result.metadata.quotes} cards`)
```

## Key Features

- **Hierarchical Preservation**: Maintains debate brief structure (sections → subsections → blocks → cards)
- **Smart Citation Parsing**: Handles various citation formats and edge cases
- **Advanced Author Recognition**: 
  - 92K human names database for validation
  - Multiple author detection (Wallace & Gromit)
  - Organizational author identification (IPCC, UN, Brookings)
  - Professional qualification filtering
- **Author Type Classification**: Distinguishes between individual, multiple, and organizational authors
- **Highlight Extraction**: Preserves marked/underlined text for key evidence
- **Comprehensive Validation**: Tracks data quality issues and missing fields
- **Flexible Year Detection**: Multiple strategies for extracting publication years
- **Author Name Cleaning**: Extracts last names and handles various formats
- **Error Tracking**: Detailed error reporting for data quality assessment

## Human Names Recognition System

### 92K Human Names Database
The system includes a comprehensive database of 92,000+ human names for validation and organization detection. This database helps distinguish between:
- **Human Authors**: Validated against the names database
- **Organizational Authors**: Detected through pattern matching and acronym recognition

### Author Type Classification
Each extracted author is classified with an `author_type` field:

| Type | Description | Example | Citation Format |
|------|-------------|---------|-----------------|
| `0` | Unknown/error | Invalid or unrecognized | Original text |
| `1` | Single human author | "Smith" | "Smith, John" |
| `2` | Two authors | "Wallace & Gromit" | "Wallace, Nick & Gromit, Peter" |
| `3` | Multiple authors (3+) | "Smith, Jones, Brown" | "Smith, John et al." |
| `4` | Single organization | "IPCC", "UN", "Brookings" | "IPCC" |

### Professional Qualification Filtering
The system automatically removes professional titles and qualifications:
- **Titles**: Dr., Professor, PhD, etc.
- **Qualifications**: "Norwegian Political Scientist", "Senior Analyst", etc.
- **Institutional Affiliations**: "at Harvard", "from Brookings", etc.

### Organization Detection
Comprehensive detection of organizational authors including:
- **Government Agencies**: EPA, FDA, CDC, NASA, etc.
- **International Organizations**: UN, NATO, EU, WHO, etc.
- **Think Tanks**: Brookings, Heritage, Cato, AEI, etc.
- **Scientific Organizations**: IPCC, NAS, AAAS, etc.
- **Acronyms**: Any 2-6 character all-caps string

## Error Codes

- `missing_summary`, `missing_citation`, `missing_author`, `missing_year`, `missing_url`
- `invalid_year`, `invalid_url_format`
- `empty_content`, `no_highlighted_text`

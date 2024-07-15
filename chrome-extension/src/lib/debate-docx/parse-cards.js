import tokens from "./docx-tokens";
import { parseDate } from "chrono-node";

export const extractCards = (doc) => {
  const anchors = getIndexesWith(doc, ["tag"]);
  return anchors.map(anchor => parseCard(doc, anchor));
};

export const parseCard = (doc, anchor = 0) => {
  const blockStyles = tokens.getHeadingStyles();
  const card = getBlocksUntil(doc, anchor, blockStyles);

  let tag = card.slice(0, 1);
  let cite = card.slice(1, 2);
  let body = card.slice(2);
  const extractHeading = (name) =>
    extractText([getAboveBlockWith(doc, anchor, [name])]);
  const shortCite = extractText(cite, ["strong"]);

  if (body.length > 1) {
    const start = extractText([body[0]]).slice(0, 50);
    if (shortCite.split(" ").find((word) => start.includes(word)))
      cite.push(...body.splice(0, 1));
  }

  let type;
  if (!body.length && cite) {
    tag.push(...cite.splice(0, 1));
    type = "analytic";
  }

  let fullcite = extractText(cite),
    url = extractURL(fullcite),
    block = extractHeading("block"),
    summary = extractText(tag),
    underlined = extractText(body, ["underline"]),
    marked = extractText(body, ["mark"]);

  let title = fullcite?.match(/[""]([^"""]*)["""]/);
  title = title ? title[1]?.replace(/[\.,]$/, "") : null;

  let currrentYear = new Date().getFullYear();
  let yearMatch = fullcite
    ?.replace(/[0-9]{1,2}[-\/][0-9]{1,2}/g, "")
    .match(/([ ''][0-9][, —-]|[0-9]{2,4})/);

  let year;
  if (yearMatch) {
    year = yearMatch ? parseInt(yearMatch[0].replace(/[^0-9]/, "")) : null;
    year = year < 26 ? year + 2000 : year <= 99 ? year + 1900 : year;
  }

  if (!year && fullcite) {
    const date = parseDate(fullcite);
    if (date && date.year != currrentYear) year = date.year;
  }

  if (year > currrentYear) year = null;
  if (year < 1900) year = null;

  if (fullcite?.match(/('ND|No Date|no date)/gi)) year = "ND";

  let author = shortCite?.replace(/[ ','0-9]+.+/g, "");
  if (author?.split(" ").length > 3)
    author = author.split(" ").slice(0, 3).join(" ").trim(" ");

  const content = tokens.tokensToMarkup(body, true);

  const html = tokens.tokensToMarkup(body, false);

  const section =
    (extractHeading("pocket") ? extractHeading("pocket") + " - " : "") +
    (extractHeading("hat") || "");

  const ranges = htmlToRanges(html);

  const contentWithRanges = rangesToHTML(content, ranges.htmltags);

  marked = ranges.marked;

  if (type == "analytic") {
    return {
      analytic: summary,
      type,
      section,
      block,
    };
  } else {
    return {
      summary,
      author,
      year,
      marked,
      markedLength: marked.length,
      cite: fullcite,
      url,
      title,
      html,
    };
  }
};

export const extractURL = (textWithURL) => {
  if (!textWithURL) return null;
  const regexPattern =
    /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/g;
  const match = textWithURL.match(regexPattern);
  if (match) {
    let firstMatch = match[0];
    if (firstMatch.endsWith(")") || firstMatch.endsWith("]") || firstMatch.endsWith("}") ||
        firstMatch.endsWith(";") || firstMatch.endsWith(":") || firstMatch.endsWith(",") ||
        firstMatch.endsWith(".") || firstMatch.endsWith("|") || firstMatch.endsWith(">") ||
        firstMatch.endsWith("<") || firstMatch.endsWith("-")) {
      firstMatch = firstMatch.slice(0, -1);
    }
    return firstMatch;
  } else {
    return null;
  }
};

export const extractText = (blocks, styles) => {
  if (!blocks[0]) return;
  return blocks
    .reduce((acc, block) => {
      const text = block.tokens?.reduce((str, token) => {
        if (!styles || styles.every((style) => token.format[style]))
          return str + token.text;
        else return str.trim() + " ";
      }, "");
      return acc.trim() + "\n" + text.trim();
    }, "")
    .trim();
};

export const getIndexesWith = (blocks, styles) => {
  return blocks.reduce((arr, block, index) => {
    const isMatch = styles.includes(block.format);
    return isMatch ? [...arr, index] : arr;
  }, []);
};

export const getAboveBlockWith = (blocks, anchor, styles) => {
  for (let i = anchor; i >= 0; i--)
    if (styles.includes(blocks[i].format)) return blocks[i];
};

export const getBlocksUntil = (blocks, anchor, styles) => {
  const subDoc = blocks.slice(anchor, blocks.length);
  const endIdx =
    subDoc.slice(1).findIndex((block) => styles.includes(block.format)) + 1;
  return subDoc.slice(0, endIdx > 0 ? endIdx : blocks.length);
};

function htmlToRanges(html) {
  let text = "",
      marked = "",
      underlined = "",
      isUnderline = 0,
      isHighlight = 0;
  const htmltags = html
    .split("<")
    .map((tagNode) => {
      const [name, content] = tagNode.split(">");

      if (!name) return;

      const index = text.length;

      text += content || "";

      if (name == "u") isUnderline = 1;
      if (name == "/u") isUnderline = 0;
      if (name == "mark") isHighlight = 1;
      if (name == "/mark") isHighlight = 0;

      if (isHighlight && content) marked += content.trim() + "…" || "";
      if (isUnderline && content) underlined += content.trim() + "…" || "";

      return [index, name];
    })
    .filter(Boolean);

  const lengthMarked = marked.length;
  const lengthUnderlined = underlined.length;

  return { marked, underlined, lengthUnderlined, lengthMarked, htmltags };
}

function rangesToHTML(text, ranges) {
  ranges = ranges.sort((a, b) => a[0] - b[0]);

  let offset = 0;
  for (const range of ranges) {
    text =
      text.slice(0, range[0] + offset) +
      "<" +
      range[1] +
      ">" +
      text.slice(range[0] + offset);

    offset += range[1].length + 2;
  }

  return text;
}
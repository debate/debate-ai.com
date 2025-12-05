import { CardData, CardDate } from "../types/card";

export type CitationFormatter = {
  key: string;
  format: (card: CardData) => string | null;
};

function formatAuthors(card: CardData, short: boolean = false): string | null {
  if (!card.authors || card.authors.length === 0) return null;

  const authors = card.authors.map((author) => author.name);

  if (short) {
    if (authors.length === 1) {
      return authors[0].split(" ").pop() || authors[0];
    } else if (authors.length === 2) {
      return (
        (authors[0].split(" ").pop() || authors[0]) +
        " and " +
        (authors[1].split(" ").pop() || authors[1])
      );
    } else {
      return (authors[0].split(" ").pop() || authors[0]) + " et al.";
    }
  }

  // Full MLA format: Last, First
  const formattedAuthors = authors.map((name) => {
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0];
    const last = parts.pop();
    const first = parts.join(" ");
    return `${last}, ${first}`;
  });

  if (formattedAuthors.length === 1) {
    return formattedAuthors[0];
  } else if (formattedAuthors.length === 2) {
    return formattedAuthors.join(" and ");
  } else {
    return formattedAuthors[0] + ", et al.";
  }
}

function formatDate(date: CardDate | null, short: boolean = false): string | null {
  if (!date) return null;

  const { month, day, year } = date;

  if (!year) return null;

  if (short) {
    return year;
  }

  let formatted = "";
  if (day) formatted += day + " ";
  if (month) formatted += month + " ";
  if (year) formatted += year;

  return formatted.trim();
}

export const citationFormatters: Record<string, CitationFormatter> = {
  bigAuthors: {
    key: "bigAuthors",
    format: (card) => formatAuthors(card, true),
  },
  bigDate: {
    key: "bigDate",
    format: (card) => formatDate(card.date, true),
  },
  authors: {
    key: "authors",
    format: (card) => formatAuthors(card, false),
  },
  title: {
    key: "title",
    format: (card) => card.title || null,
  },
  siteName: {
    key: "siteName",
    format: (card) => card.siteName || null,
  },
  date: {
    key: "date",
    format: (card) => formatDate(card.date, false),
  },
  url: {
    key: "url",
    format: (card) => card.url || null,
  },
  accessDate: {
    key: "accessDate",
    format: (card) => {
      if (!card.accessDate) return null;
      return "Accessed " + formatDate(card.accessDate, false);
    },
  },
};

// Generate MLA citation
export function generateMLACitation(card: CardData): string {
  const authors = citationFormatters.authors.format(card);
  const title = citationFormatters.title.format(card);
  const siteName = citationFormatters.siteName.format(card);
  const date = citationFormatters.date.format(card);
  const url = citationFormatters.url.format(card);

  let citation = "";
  if (authors) citation += authors + ". ";
  if (title) citation += `"${title}." `;
  if (siteName) citation += `${siteName}, `;
  if (date) citation += date + ", ";
  if (url) citation += url + " ";

  return citation.trim();
}

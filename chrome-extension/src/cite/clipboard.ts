import type { ICard } from './types';
import { formatters } from './citeFormatters';

export function cardToHtml(
  card: ICard,
  shrunk: boolean,
  includeCite: boolean = true,
  includeFont: boolean = true
): HTMLElement {
  let html = document.createElement('div');
  if (includeCite) {
    let title = document.createElement('h3');
    title.textContent = card.tag;
    if (includeFont) {
      title.style.fontFamily = 'Calibri';
    }
    title.style.fontSize = '13pt';
    title.style.margin = '0px';
    html.appendChild(title);

    let cite = document.createElement('p');
    if (includeFont) {
      cite.style.fontFamily = 'Calibri';
    }
    cite.style.margin = '0px';

    let bigCitePart = document.createElement('span');
    bigCitePart.textContent = `${formatters.bigAuthors.format(
      card
    )}, ${formatters.bigDate.format(card)} `;
    bigCitePart.style.fontSize = '13pt';
    bigCitePart.style.fontWeight = 'bold';
    cite.appendChild(bigCitePart);

    let smallCitePart = document.createElement('span');
    smallCitePart.textContent = `[${formatters.authors.format(
      card
    )}. ${formatters.date.format(card)}. "${formatters.title.format(
      card
    )}". ${formatters.siteName.format(card)}. ${formatters.url.format(
      card
    )}. ${formatters.accessDate.format(card)}]`;
    smallCitePart.style.fontSize = '11pt';

    cite.appendChild(smallCitePart);
    html.appendChild(cite);
  }
  for (let para of card.paras) {
    let p = document.createElement('p');
    if (includeFont) {
      p.style.fontFamily = 'Calibri';
    }
    p.style.fontSize = '11pt';
    p.style.margin = '0.8em 0';
    p.style.lineHeight = '1.15em';

    for (let span of para) {
      let s = document.createElement('span');
      s.innerText = span.text;
      if (span.underline) {
        s.style.textDecoration = 'underline';
      }
      if (!span.underline && shrunk) {
        s.style.fontSize = '8pt';
      }
      if (span.highlight) {
        s.style.backgroundColor = 'yellow';
      }
      p.appendChild(s);
    }
    html.appendChild(p);
  }
  return html;
}
export function copyCard(card: ICard, shrunk = false): void {
  let html = cardToHtml(card, shrunk);
  copyHtmlToClipboard(html);
}
function copyHtmlToClipboard(html: HTMLElement) {
  let HTMLBlob = new Blob([html.innerHTML], { type: 'text/html' });
  // add newlines between paragraphs for raw text
  for (let child of html.children) {
    child.appendChild(document.createTextNode('\n'));
  }
  let textBlob = new Blob([html.textContent ?? ''], { type: 'text/plain' });
  const clipboardItem = new window.ClipboardItem({
    'text/html': HTMLBlob,
    'text/plain': textBlob,
  });
  navigator.clipboard.write([clipboardItem]);
}

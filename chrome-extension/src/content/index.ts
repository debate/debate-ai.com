import type { ICard } from './types';
import { Readability } from './readability';

// stolen from https://github.com/flickz/newspaperjs/blob/master/lib/extractor.js
// function getTitle() {
//   let title: string;

//   title = document
//     .querySelector("meta[property='og:title']")
//     ?.getAttribute('content');
//   if (validData(title)) return title;

//   title = document
//     .querySelector("meta[property='twitter:title']")
//     ?.getAttribute('content');
//   if (validData(title)) return title;

//   title = document.querySelector('title')?.textContent;
//   if (validData(title)) return title;

//   title = document.querySelector('h1')?.textContent;
//   if (validData(title)) return title;

//   return null;
// }

// // new york time
// // document.querySelectorAll("*[itemprop='name']")

// function getAuthor() {
//   let author: string;
//   author = document
//     .querySelector("meta[name='author']")
//     ?.getAttribute('content');
//   if (validData(author)) return author;
//   author = document
//     .querySelector("meta[property='author']")
//     ?.getAttribute('content');
//   if (validData(author)) return author;
//   author = document
//     .querySelector("meta[name='twitter:creator']")
//     ?.getAttribute('content');
//   if (validData(author)) return author;
//   // opengraph
//   author = document
//     .querySelector("meta[property='article:author']")
//     ?.getAttribute('content');
//   if (validData(author)) return author;
//   // desperation
//   let paras = document.querySelectorAll('p');
//   for (let i = 0; i < Math.min(5, paras.length); i++) {
//     let el = paras[i];
//     let formatted = el.textContent.toLowerCase();
//     if (el.textContent.length < 100 && formatted.includes('by')) {
//       author = el.textContent.slice(formatted.indexOf('by') + 2);
//       if (validData(author)) return author;
//     }
//   }
//   return null;
// }

// function getUrl() {
//   return window.location.href;
// }

// function getParas() {
//   let paras: string[] = [];
//   let elements = document.querySelectorAll('p');
//   // combine elements, with newlines in between
//   for (let i = 0; i < elements.length; i++) {
//     let el = elements[i];
//     let text = el.textContent;
//     let lowerText = text.toLowerCase();
//     if (!validPara(text)) continue;
//     if (text.length < 100) {
//       if (i < 5 && lowerText.includes('by')) {
//         continue;
//       }
//     }
//     paras.push(text);
//   }
//   return paras;
// }
function validData(data: string) {
  if (data == null || data == undefined) {
    return false;
  }
  // check if data is only whitespace
  if (data.trim().length == 0) {
    return false;
  }
  return true;
}
function validPara(para: string) {
  if (!validData(para)) return false;
  if (para == 'Image') return false;
  return true;
}
function getDate() {
  let date: string;

  let metaDataNames = {
    property: [
      'article:published',
      'article:published_time',
      'og:pubdate',
      'pubdate',
      'sailthru.date',
      // 'lastPublishedDate',
    ],
    itemprop: ['date', 'datePublished', 'dateCreated'],
    name: [
      'date',
      'dateCreated',
      'datePublished',
      'pdate',
      'sailthru.date',
      'dc.date.issued',
      'dc.date.created',
      'dc.date',
      'dcterms.created',
    ],
  };
  for (let key in metaDataNames) {
    for (let name of metaDataNames[key]) {
      date = document
        .querySelector(`meta[${key}='${name}']`)
        ?.getAttribute('content');
      if (validData(date)) return date;
    }
  }
  // extract schema.org metadata
  let jsonLds = document.getElementsByTagName('script');
  for (let el of jsonLds) {
    if (el.getAttribute('type') === 'application/ld+json') {
      let content = el.textContent.replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, '');
      let parsed = JSON.parse(content);
      if (!parsed['@context']?.match(/^https?\:\/\/schema\.org\/?$/)) {
        continue;
      }
      if (validData(parsed.datePublished)) {
        return parsed.datePublished;
      }
      if (validData(parsed.dateCreated)) {
        return parsed.dateCreated;
      }
      if (validData(parsed.dateModified)) {
        return parsed.dateModified;
      }
    }
  }
  let time = document.getElementsByTagName('time');
  for (let el of time) {
    if (el.getAttribute('datetime') && validData(el.getAttribute('datetime'))) {
      return el.getAttribute('datetime');
    }
  }

  // desperation
  let possibleDateTags = ['time', 'span', 'div', 'p', '*'];
  for (let tag of possibleDateTags) {
    for (let el of document.getElementsByTagName(tag)) {
      if (el.textContent.includes('Published')) {
        date = el.textContent.split('Published')[1].trim();
        if (validData(date)) return date;
      } else if (el.textContent.includes('Updated')) {
        date = el.textContent.split('Updated')[1].trim();
        if (validData(date)) return date;
      } else if (el.textContent.includes('Posted')) {
        date = el.textContent.split('Posted')[1].trim();
        if (validData(date)) return date;
      }
    }
  }
  return null;
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  let documentCopy = document.cloneNode(true);
  let article = new Readability(documentCopy, {
    debug: false,
    charThreshold: 0,
  }).parse();

  let articleNode = document.createElement('div');
  articleNode.innerHTML = article.content;

  let title: string = article.title;
  let authorString: string = article.byline;
  // split author into seperate authors
  // split by and, &, and ,
  let authors: {
    name: string;
    isPerson: boolean;
    description: string | null;
    id: number;
  }[] = [];
  if (authorString) {
    // remove whitespace
    authorString = authorString.trim();
    const isAllCaps = authorString.toUpperCase() == authorString;
    // remove by, and other from start if it exists
    if (authorString.toLowerCase().startsWith('by')) {
      authorString = authorString.slice(2).trim();
    }
    authors = authorString
      .split(/ and | & |,|\|/)

      .map((author) => author.trim())
      .filter((author) => {
        // remove empty strings
        if (author.length < 0) return false;
        // remove only capital letters (CNN etc)
        if (!isAllCaps && author.toUpperCase() == author) return false;

        return true;
      })
      .map((authorName, index) => {
        let isPerson = true;
        // check if author is a person
        // if author name includes acronym
        if (!isAllCaps && authorName.match(/[A-Z]{2,}/)) {
          isPerson = false;
        }
        // if author name includes number
        else if (authorName.match(/[0-9]/)) {
          isPerson = false;
        }
        // if author name includes a word that is not a name

        return { name: authorName, isPerson, description: null, id: index };
      });
  }

  const dateString: string = getDate();
  let date: { month: string; day: string; year: string } = {
    month: null,
    day: null,
    year: null,
  };
  if (dateString != undefined && dateString.length > 0) {
    const dateObj = new Date(dateString);
    if (dateObj instanceof Date && !isNaN(dateObj.valueOf())) {
      date.month = (dateObj.getMonth() + 1).toString();
      date.day = dateObj.getDate().toString();
      date.year = dateObj.getFullYear().toString();
    }
  }

  let url: string =
    location.protocol + '//' + location.host + location.pathname;
  let siteName = article.siteName;
  if (!siteName) {
    let urlParts = location.host.split('.');
    siteName = urlParts[urlParts.length - 2];
    // captialize first letter
    siteName = siteName[0].toUpperCase() + siteName.slice(1);
  }
  let paraStrings: string[] = [];


  var optionExtractOnlySelection = false;

  // if user is selecting something get range
  if (optionExtractOnlySelection ){
         
      // get selection
      let selectedText = window.getSelection().toString();
      if(selectedText.trim().length > 0) {
        // split by newlines and remove empty strings
        paraStrings = selectedText
          .split(/\r|\n/)
          .map((para) => para.trim())
          .filter((para) => para.length > 0);
      }
  } else {
    // if no selection get all paragraphs
    paraStrings = Array.from(articleNode.querySelectorAll('p'))
      .map((p) => p.textContent.trim().replace('\r', '').replace('\n', ''))
      .filter((para) => validPara(para));
  }
  let paras = paraStrings.map((para) => {
    return [{ text: para.trim(), highlight: false, underline: false }];
  });

  const currentDate = new Date();
  if (request.message === 'getCardData') {
    let card: ICard = {
      tag: '',
      title: title,
      authors: authors,
      date: date,
      url: url,
      siteName: siteName,
      paras: paras,
      accessDate: {
        month: (currentDate.getMonth() + 1).toString(),
        day: currentDate.getDate().toString(),
        year: currentDate.getFullYear().toString(),
      },
    };
    sendResponse({
      message: 'gotCardData',
      card,
    });
  }
});

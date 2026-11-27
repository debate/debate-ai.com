import { describe, expect, it } from 'vitest';

import {
  describeReferenceCitation,
  firstSurname,
  isSafeArticleUrl,
  rankSearchResults,
  referenceSearchQueries,
  referenceUrl,
  verifyArticle,
} from '../src/references';

const HARPERS =
  'Ackerman, Elliot, et al. “A Letter on Justice and Open Debate.” <em>Harper’s Magazine</em>, July 7, 2020. <a href="https://harpers.org/a-letter-on-justice-and-open-debate/">harpers.org/a-letter-on-justice-and-open-debate/</a>.';
const BOOK =
  'Afary, Janet, and Kevin B. Anderson. <em>Foucault and the Iranian Revolution: Gender and the Seductions of Islamism</em>. Chicago: University of Chicago Press, 2005.';

describe('describeReferenceCitation', () => {
  it('reads an article entry: title, publication, year, link', () => {
    const ref = describeReferenceCitation(HARPERS, { authors: 'Ackerman', year: '2020' });
    expect(ref.title).toBe('A Letter on Justice and Open Debate');
    expect(ref.publication).toBe('Harper’s Magazine');
    expect(ref.authors).toBe('Ackerman');
    expect(ref.year).toBe('2020');
    expect(ref.url).toBe('https://harpers.org/a-letter-on-justice-and-open-debate/');
    expect(ref.citation).not.toContain('harpers.org');
  });

  it('takes a book entry’s italic title and has no link', () => {
    const ref = describeReferenceCitation(BOOK, { authors: 'Afary & Anderson', year: '2005' });
    expect(ref.title).toBe('Foucault and the Iranian Revolution: Gender and the Seductions of Islamism');
    expect(ref.publication).toBe('');
    expect(ref.url).toBe('');
  });

  it('falls back to a bare URL in the text and to the byline and year', () => {
    const ref = describeReferenceCitation('Smith, Jane. “Short title here.” 2019. See https://example.org/a?b=1&amp;c=2.');
    expect(ref.url).toBe('https://example.org/a?b=1&c=2');
    expect(ref.year).toBe('2019');
    expect(ref.authors).toContain('Smith');
  });

  it('decodes entities and ignores non-web links', () => {
    expect(referenceUrl('<a href="javascript:alert(1)">x</a>')).toBe('');
    expect(referenceUrl('<a href="https://a.test/x?y=1&amp;z=2">x</a>')).toBe('https://a.test/x?y=1&z=2');
  });
});

describe('isSafeArticleUrl', () => {
  it.each([
    'http://localhost/admin',
    'http://127.0.0.1/',
    'http://0x7f.1/',
    'http://2130706433/',
    'http://10.0.0.5/x',
    'http://192.168.1.1/',
    'http://172.20.0.1/',
    'http://169.254.169.254/latest/meta-data',
    'http://100.64.0.1/',
    'http://[::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://intranet/page',
    'http://printer.local/',
    'http://service.internal/',
    'https://user:pass@example.com/',
    'https://example.com:8443/',
    'ftp://example.com/file',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'not a url',
    '',
  ])('refuses %s', (url) => {
    expect(isSafeArticleUrl(url).ok).toBe(false);
  });

  it('allows public pages and drops the fragment', () => {
    const result = isSafeArticleUrl('https://harpers.org/a-letter/?x=1#section');
    expect(result).toEqual({ ok: true, url: 'https://harpers.org/a-letter/?x=1' });
    expect(isSafeArticleUrl('http://93.184.216.34/page').ok).toBe(true);
  });
});

describe('firstSurname', () => {
  it.each([
    ['Hansson & Reijven', 'Hansson'],
    ['Galloway', 'Galloway'],
    ['Ackerman, Elliot, et al.', 'Ackerman'],
    ['Elliot Ackerman', 'Ackerman'],
    ['Afary, Janet, and Kevin B. Anderson', 'Afary'],
    ['', ''],
  ])('%s → %s', (authors, surname) => {
    expect(firstSurname(authors)).toBe(surname);
  });
});

describe('referenceSearchQueries', () => {
  it('quotes the title with the surname, then adds the publication and year', () => {
    const ref = describeReferenceCitation(HARPERS, { authors: 'Ackerman', year: '2020' });
    expect(referenceSearchQueries(ref)).toEqual([
      '"A Letter on Justice and Open Debate" Ackerman',
      'A Letter on Justice and Open Debate Harper’s Magazine 2020',
    ]);
  });

  it('searches the byline when there is no title, and nothing when there is nothing', () => {
    expect(referenceSearchQueries({ authors: 'Galloway', year: '2020', publication: 'Wired' })[0]).toBe('Galloway 2020 Wired');
    expect(referenceSearchQueries({})).toEqual([]);
  });
});

describe('rankSearchResults', () => {
  const ref = describeReferenceCitation(HARPERS, { authors: 'Ackerman', year: '2020' });
  const hits = [
    { title: 'Open debate - Wikipedia', url: 'https://en.wikipedia.org/wiki/Open_debate', content: 'Debate about openness.' },
    {
      title: 'A Letter on Justice and Open Debate | Harper’s Magazine',
      url: 'https://harpers.org/a-letter-on-justice-and-open-debate/#top',
      content: 'The free exchange of information and ideas, July 7, 2020. Elliot Ackerman',
    },
    { title: 'Private', url: 'http://127.0.0.1/a-letter-on-justice-and-open-debate', content: 'A Letter on Justice and Open Debate' },
    { title: 'Duplicate', url: 'https://harpers.org/a-letter-on-justice-and-open-debate/' },
    { title: 'No url' },
  ];

  it('puts the matching page first and drops unsafe, duplicate and address-less hits', () => {
    const ranked = rankSearchResults(hits, ref);
    expect(ranked.map((hit) => hit.url)).toEqual([
      'https://harpers.org/a-letter-on-justice-and-open-debate/',
      'https://en.wikipedia.org/wiki/Open_debate',
    ]);
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
  });
});

describe('verifyArticle', () => {
  const ref = describeReferenceCitation(HARPERS, { authors: 'Ackerman', year: '2020' });

  it('accepts the page whose title agrees with the entry', () => {
    const verdict = verifyArticle(
      { title: 'A Letter on Justice and Open Debate', author: 'Elliot Ackerman', text: 'The free exchange of information' },
      ref,
    );
    expect(verdict.accepted).toBe(true);
    expect(verdict.score).toBeGreaterThan(0.9);
  });

  it('accepts a retitled page when the title is in its opening text', () => {
    const verdict = verifyArticle(
      { title: 'Harper’s Magazine', text: 'A Letter on Justice and Open Debate. Our cultural institutions are facing a moment of trial.' },
      ref,
    );
    expect(verdict.accepted).toBe(true);
  });

  it('rejects an unrelated article on the same topic', () => {
    const verdict = verifyArticle(
      { title: 'Why open debate matters', text: 'Debate and justice are discussed in many universities across the country.' },
      ref,
    );
    expect(verdict.accepted).toBe(false);
  });

  it('rejects when the entry has nothing to compare', () => {
    expect(verifyArticle({ title: 'Anything', text: 'Some text' }, {}).accepted).toBe(false);
  });
});

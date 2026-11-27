import { describe, expect, it } from 'vitest';
import { collectCollections, buildAuthorsDataset } from '../../lib/authors/collect-authors';
import {
  attributeQualifications,
  extractAuthorsDataset,
  sanitizeCitationHtml,
  sanitizeQuoteHtml,
  splitCard,
  type CollectionSource,
} from '../../lib/authors/extract-authors';

const card = (summary: string, qualification: string, quote: string) =>
  `<div class="debate-card"><p>${summary}</p>${qualification ? `<p><em>${qualification}</em></p>` : ''}<hr />${quote}</div>`;

function fixture(references: string, pages: CollectionSource['pages'] = []): CollectionSource[] {
  return [{ dir: 'journal/test', title: 'Test Paper', referencesSource: `---\ntitle: References\n---\n\n${references}`, pages }];
}

const entry = (number: number, citation: string, body = '') => `${number}. <details><summary>${citation}</summary>${body}</details>`;

describe('splitCard', () => {
  it('splits summary, qualification and quote around the rule', () => {
    const parts = splitCard(card('Why it matters.', 'Professor, State U', '<p><u><mark>Read this.</mark></u> And this.</p>'));
    expect(parts).toEqual({ summary: 'Why it matters.', qualification: 'Professor, State U', quoteHtml: '<p><u><mark>Read this.</mark></u> And this.</p>' });
  });

  it('has no quote when the card is only a summary', () => {
    expect(splitCard('<div class="debate-card"><p>Only a tag.</p></div>').quoteHtml).toBe('');
  });

  it('reads a card with no rule: summary, optional qualification, then the quote', () => {
    const parts = splitCard('<div class="debate-card"><p>Tag.</p><p><em>Dr. X</em></p><p>Quote.</p></div>');
    expect(parts).toMatchObject({ summary: 'Tag.', qualification: 'Dr. X', quoteHtml: '<p>Quote.</p>' });
  });
});

describe('sanitizing', () => {
  it('keeps only the markup a card needs', () => {
    expect(sanitizeQuoteHtml('<p onclick="x()"><u><mark class="a">hi</mark></u><script>alert(1)</script></p>')).toBe('<p><u><mark>hi</mark></u>alert(1)</p>');
  });

  it('keeps https links, drops other schemes and unwraps markdown link residue', () => {
    expect(sanitizeCitationHtml('<em>T</em> <a href="https://a.test/x">a.test</a> <a href="javascript:alert(1)">bad</a>')).toBe('<em>T</em> <a href="https://a.test/x">a.test</a> bad');
    expect(sanitizeCitationHtml('See [www.a.test](https://www.a.test).')).toBe('See www.a.test.');
  });
});

describe('attributeQualifications', () => {
  const bleiker = { family: 'Bleiker', given: 'Roland', suffix: '' };
  const kay = { family: 'Kay', given: 'Amy', suffix: '' };

  it('gives each author their own clause', () => {
    expect(attributeQualifications('Roland Bleiker — Professor of IR, Queensland; Amy Kay — co-author, University of Queensland', [bleiker, kay])).toEqual([
      'Professor of IR, Queensland',
      'University of Queensland',
    ]);
  });

  it('shares an unnamed qualification between the authors', () => {
    expect(attributeQualifications('Professors of Politics, Lancaster', [bleiker, kay])).toEqual(['Professors of Politics, Lancaster', 'Professors of Politics, Lancaster']);
  });

  it('gives a qualification that names one author to that author only', () => {
    expect(attributeQualifications('Amy Kay, Lecturer, Queensland', [bleiker, kay])).toEqual(['', 'Lecturer, Queensland']);
  });
});

describe('extractAuthorsDataset on a fixture', () => {
  const dataset = extractAuthorsDataset(
    fixture(
      [
        entry(
          1,
          'Carlin, Diana, and David Levasseur. <em>Debate Theory</em>. Boston: Press, 1998.',
          card('A tag.', 'Professor, Kansas', '<p><u>Quote one.</u></p>'),
        ),
        entry(2, 'Carlin, Diana. “An Article.” <em>Journal of Debate</em> 3 (2001): 1–9.', card('Another.', 'Professor, Kansas', '<p>Plain.</p>')),
        entry(3, 'Carlin, D. “Short.” <em>Journal of Debate</em> 4 (2002): 1–2.', card('Third.', '', '')),
        entry(4, 'Cleveland Clinic. “Report.” <em>Cleveland Clinic</em>, 2020. <a href="https://c.test">c.test</a>.'),
        entry(5, '<em>Brandenburg v. Ohio</em>, 395 U.S. 444 (1969).'),
        entry(6, 'Gulakov, Alex [posting as Synergy]. “Post.” <em>Blog</em>, 2024.'),
      ].join('\n'),
      [{ path: '/docs/journal/test/one', title: 'One', source: 'As Carlin (1998) argues, and also (Carlin 2001).' }],
    ),
  );
  const bySlug = (slug: string) => dataset.authors.find((author) => author.slug === slug)!;

  it('merges spellings of one person and counts their cards', () => {
    expect(bySlug('diana-carlin').cardCount).toBe(3);
    expect(bySlug('diana-carlin').quoteCount).toBe(2);
    expect(bySlug('diana-carlin').qualifications).toBe('Professor, Kansas');
    expect(dataset.authors.filter((author) => author.slug.includes('carlin'))).toHaveLength(1);
  });

  it('credits co-authors in byline order', () => {
    const first = dataset.citations[0]!;
    expect(first.authors.map((link) => link.authorId)).toEqual(['author:diana-carlin', 'author:david-levasseur']);
    expect(first.authors.map((link) => link.position)).toEqual([0, 1]);
  });

  it('lists organizations as authors and gives court cases none', () => {
    expect(bySlug('cleveland-clinic').kind).toBe('institution');
    expect(dataset.citations[4]!.authors).toEqual([]);
    expect(dataset.stats.unauthoredCitations).toBe(1);
  });

  it('records a pen name as an alias', () => {
    expect(bySlug('alex-gulakov').aliases).toEqual(['Synergy']);
  });

  it('records where each card is cited in running text', () => {
    expect(dataset.citations[0]!.citedIn).toEqual([{ path: '/docs/journal/test/one', title: 'One' }]);
    expect(dataset.citations[1]!.citedIn).toEqual([{ path: '/docs/journal/test/one', title: 'One' }]);
  });

  it('fills in the citation fields', () => {
    const first = dataset.citations[0]!;
    expect(first).toMatchObject({
      id: 'journal/test#ref-carlin-1998',
      anchor: 'ref-carlin-1998',
      pagePath: '/docs/journal/test/references',
      year: '1998',
      yearNumber: 1998,
      title: 'Debate Theory',
      sourceKind: 'book',
      quoteStatus: 'underlined',
      quoteText: 'Quote one.',
      quoteWordCount: 2,
    });
    expect(dataset.citations[3]!.url).toBe('https://c.test');
  });

  it('lists authors in bibliography order', () => {
    expect(dataset.authors.map((author) => author.slug)).toEqual([...dataset.authors].sort((a, b) => a.sortName.localeCompare(b.sortName)).map((author) => author.slug));
    expect(dataset.stats).toMatchObject({ citations: 6, authors: 4, institutions: 1 });
  });

  it('is deterministic', () => {
    expect(JSON.stringify(extractAuthorsDataset(fixture('')))).toBe(JSON.stringify(extractAuthorsDataset(fixture(''))));
  });
});

describe('the real References pages', () => {
  const dataset = buildAuthorsDataset();
  const bySlug = (slug: string) => dataset.authors.find((author) => author.slug === slug);

  it('reads every folder with a References page', () => {
    expect(collectCollections().map((collection) => collection.dir).sort()).toEqual([
      'journal/debate-ai-collective-consciousness',
      'journal/synergy-slayer-critiques',
      'journal/synergy-slayer-intrinsicness',
    ]);
    expect(dataset.stats.citations).toBeGreaterThan(300);
  });

  it('gives every card an author unless it is a court case or unsigned', () => {
    const unsigned = dataset.citations.filter((citation) => citation.authors.length === 0);
    expect(unsigned.every((citation) => citation.sourceKind === 'court')).toBe(true);
  });

  it('has unique slugs and ids, and every link points at a real author', () => {
    const ids = new Set(dataset.authors.map((author) => author.id));
    expect(ids.size).toBe(dataset.authors.length);
    expect(new Set(dataset.authors.map((author) => author.slug)).size).toBe(dataset.authors.length);
    expect(new Set(dataset.citations.map((citation) => citation.id)).size).toBe(dataset.citations.length);
    for (const citation of dataset.citations) for (const link of citation.authors) expect(ids.has(link.authorId)).toBe(true);
  });

  it('keeps same-surname co-authors apart', () => {
    for (const slug of ['lana-wachowski', 'lilly-wachowski', 'mark-engler', 'paul-engler', 'arthur-kleinman', 'joan-kleinman']) {
      expect(bySlug(slug), slug).toBeDefined();
    }
  });

  it('handles suffixes, particles, accents and corporate authors', () => {
    expect(bySlug('george-c-edwards-iii')?.name).toBe('George C. Edwards III');
    expect(bySlug('roland-g-fryer-jr')?.name).toBe('Roland G. Fryer Jr.');
    expect(bySlug('rens-van-munster')?.name).toBe('Rens van Munster');
    expect(bySlug('slavoj-zizek')?.name).toBe('Slavoj Žižek');
    expect(bySlug('u-s-department-of-education')?.kind).toBe('institution');
    expect(bySlug('alex-gulakov')?.aliases).toContain('Synergy');
  });

  it('keeps each card quote under D1’s statement limit', () => {
    for (const citation of dataset.citations) expect(JSON.stringify(citation).length).toBeLessThan(90_000);
  });

  it('counts a card once per author even when a byline repeats a name', () => {
    for (const author of dataset.authors) {
      const cards = dataset.citations.filter((citation) => citation.authors.some((link) => link.authorId === author.id));
      expect(author.cardCount).toBe(cards.length);
    }
  });
});

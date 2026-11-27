import { describe, expect, it } from 'vitest';
import { displayName, foldName, mergeNameVariants, parseAuthorPart, searchKey, slugify } from '../../lib/authors/author-names';

describe('slugify and searchKey', () => {
  it('folds accents and special letters', () => {
    expect(slugify('Slavoj Žižek')).toBe('slavoj-zizek');
    expect(slugify('Ole Wæver')).toBe('ole-waever');
    expect(foldName('Gearóid Ó Tuathail')).toBe('gearoid o tuathail');
  });

  it('drops apostrophes instead of splitting on them', () => {
    expect(slugify('Rosemary O’Kane')).toBe('rosemary-okane');
    expect(searchKey('Rosemary O’Kane')).toBe('rosemary okane');
  });
});

describe('parseAuthorPart', () => {
  it('reads one person, family name first', () => {
    const parsed = parseAuthorPart('Pinker, Steven');
    expect(parsed.kind).toBe('person');
    expect(parsed.people.map(displayName)).toEqual(['Steven Pinker']);
  });

  it('reads co-authors and keeps middle initials', () => {
    const parsed = parseAuthorPart('Krause, Keith, and Michael C. Williams');
    expect(parsed.people.map(displayName)).toEqual(['Keith Krause', 'Michael C. Williams']);
  });

  it('keeps Jr. and III as a suffix, even when the byline leaves it on the given names', () => {
    const [fryer, torelli] = parseAuthorPart('Fryer, Roland G. Jr., and Paul Torelli').people;
    expect(fryer).toMatchObject({ family: 'Fryer', given: 'Roland G.', suffix: 'Jr.' });
    expect(displayName(fryer!)).toBe('Roland G. Fryer Jr.');
    expect(torelli!.family).toBe('Torelli');
    expect(parseAuthorPart('Edwards, George C., III').people[0]).toMatchObject({ family: 'Edwards', given: 'George C.', suffix: 'III' });
  });

  it('puts particles on the family name', () => {
    const [munster] = parseAuthorPart('Munster, Rens van').people;
    expect(munster).toMatchObject({ family: 'van Munster', given: 'Rens' });
    expect(slugify(displayName(munster!))).toBe('rens-van-munster');
  });

  it('flags et al. and reads the role the byline gives', () => {
    const parsed = parseAuthorPart('Foster, Peter, et al.');
    expect(parsed.etAl).toBe(true);
    expect(parsed.people).toHaveLength(1);
    expect(parseAuthorPart('Macauley, David, ed.').role).toBe('editor');
    expect(parseAuthorPart('Hirschbiegel, Oliver, dir.').role).toBe('director');
  });

  it('turns a [posting as …] handle into an alias, not a name', () => {
    const parsed = parseAuthorPart('Gulakov, Alex [posting as Synergy]');
    expect(parsed.alias).toBe('Synergy');
    expect(parsed.people.map(displayName)).toEqual(['Alex Gulakov']);
  });

  it('treats a byline with no comma as an organization', () => {
    const parsed = parseAuthorPart('Cleveland Clinic');
    expect(parsed).toMatchObject({ kind: 'institution', institution: 'Cleveland Clinic', people: [] });
  });

  it('names a recognized organization by the part before its first comma', () => {
    const parsed = parseAuthorPart('U.S. Department of Education, Office for Civil Rights', '<em>x</em>');
    expect(parsed.kind).toBe('institution');
    expect(parsed.institution).toBe('U.S. Department of Education');
  });
});

describe('mergeNameVariants', () => {
  const person = (family: string, given: string, suffix = '') => ({ family, given, suffix });

  it('merges an initial with the full spelling', () => {
    const { people } = mergeNameVariants([person('Williams', 'Michael C.'), person('Williams', 'M.')]);
    expect(people).toHaveLength(1);
    expect(people[0]!.canonical.given).toBe('Michael C.');
    expect(people[0]!.members.sort()).toEqual([0, 1]);
  });

  it('keeps apart people who share a surname', () => {
    const { people } = mergeNameVariants([person('Wachowski', 'Lana'), person('Wachowski', 'Lilly'), person('Engler', 'Mark'), person('Engler', 'Paul')]);
    expect(people).toHaveLength(4);
  });

  it('leaves an initial that fits two people unmerged and reports it', () => {
    const { people, ambiguous } = mergeNameVariants([person('Smith', 'John'), person('Smith', 'Jane'), person('Smith', 'J.')]);
    expect(people).toHaveLength(3);
    expect(ambiguous).toEqual([2]);
  });

  it('does not merge different suffixes', () => {
    const { people } = mergeNameVariants([person('Edwards', 'George C.', 'III'), person('Edwards', 'George C.', 'Jr.')]);
    expect(people).toHaveLength(2);
  });
});

import { describe, expect, it } from 'vitest';
import { compare, compareParsed, format, isNewer, isPrerelease, parse } from './semver';

describe('parse', () => {
  it('lit une version simple', () => {
    expect(parse('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, pre: [], build: [] });
    expect(parse('0.0.0')).toEqual({ major: 0, minor: 0, patch: 0, pre: [], build: [] });
    expect(parse('10.20.30')).toEqual({ major: 10, minor: 20, patch: 30, pre: [], build: [] });
  });

  it('accepte le préfixe v/V et les espaces', () => {
    expect(parse('v1.2.3')).toEqual(parse('1.2.3'));
    expect(parse('V1.2.3')).toEqual(parse('1.2.3'));
    expect(parse('  v1.2.3\n')).toEqual(parse('1.2.3'));
  });

  it('lit pré-versions et métadonnées de build', () => {
    expect(parse('1.2.0-beta.1')?.pre).toEqual(['beta', 1]);
    expect(parse('1.0.0-alpha')?.pre).toEqual(['alpha']);
    expect(parse('1.0.0-0.3.7')?.pre).toEqual([0, 3, 7]);
    expect(parse('1.0.0-x.7.z.92')?.pre).toEqual(['x', 7, 'z', 92]);
    expect(parse('1.0.0-x-y-z.--')?.pre).toEqual(['x-y-z', '--']);
    expect(parse('1.0.0-0a')?.pre).toEqual(['0a']);
    expect(parse('1.0.0+20130313144700')?.build).toEqual(['20130313144700']);
    expect(parse('1.0.0-beta+exp.sha.5114f85')).toMatchObject({
      pre: ['beta'],
      build: ['exp', 'sha', '5114f85'],
    });
    expect(parse('1.0.0+001')?.build).toEqual(['001']);
  });

  it('lit les versions de développement de Tessel', () => {
    expect(parse('0.0.0-dev')).toMatchObject({ major: 0, pre: ['dev'] });
    expect(parse('0.0.0-development')).toMatchObject({ pre: ['development'] });
    expect(parse('0.0.0-web')).toMatchObject({ pre: ['web'] });
  });

  it.each([
    '',
    ' ',
    'v',
    '1',
    '1.2',
    '1.2.3.4',
    'a.b.c',
    '01.2.3',
    '1.02.3',
    '1.2.03',
    '-1.2.3',
    '1.2.3-',
    '1.2.3-01',
    '1.2.3-beta..1',
    '1.2.3-.beta',
    '1.2.3+',
    '1.2.3+a..b',
    '1.2.3-beta_1',
    '1.2.3 beta',
    'vv1.2.3',
    'release-1.2.3',
    '1.2.x',
    '99999999999999999999.0.0',
    '1.0.0-99999999999999999999',
  ])('refuse « %s »', (input) => {
    expect(parse(input)).toBeNull();
  });
});

describe('compare', () => {
  it('compare numériquement, pas alphabétiquement', () => {
    expect(compare('1.2.10', '1.2.9')).toBeGreaterThan(0);
    expect(compare('1.10.0', '1.9.9')).toBeGreaterThan(0);
    expect(compare('10.0.0', '9.99.99')).toBeGreaterThan(0);
    expect(compare('1.0.0', '2.0.0')).toBeLessThan(0);
    expect(compare('1.0.0', '1.1.0')).toBeLessThan(0);
    expect(compare('1.0.0', '1.0.1')).toBeLessThan(0);
    expect(compare('1.2.3', '1.2.3')).toBe(0);
  });

  it('ignore le préfixe v', () => {
    expect(compare('v1.2.3', '1.2.3')).toBe(0);
    expect(compare('v2.0.0', 'v1.9.9')).toBeGreaterThan(0);
  });

  it('place une pré-version avant sa version finale', () => {
    expect(compare('1.2.0-beta.1', '1.2.0')).toBeLessThan(0);
    expect(compare('1.2.0', '1.2.0-beta.1')).toBeGreaterThan(0);
    expect(compare('1.2.0-rc.1', '1.2.0')).toBeLessThan(0);
  });

  it('une pré-version reste après la version finale précédente', () => {
    expect(compare('1.2.0-alpha', '1.1.9')).toBeGreaterThan(0);
    expect(compare('1.2.0-alpha', '1.1.0')).toBeGreaterThan(0);
    expect(compare('2.0.0-alpha', '1.99.99')).toBeGreaterThan(0);
  });

  it("suit l'exemple de précédence de la spécification semver 2.0", () => {
    const ordered = [
      '1.0.0-alpha',
      '1.0.0-alpha.1',
      '1.0.0-alpha.beta',
      '1.0.0-beta',
      '1.0.0-beta.2',
      '1.0.0-beta.11',
      '1.0.0-rc.1',
      '1.0.0',
      '2.0.0',
      '2.1.0',
      '2.1.1',
    ];
    for (let i = 0; i < ordered.length; i++) {
      for (let j = 0; j < ordered.length; j++) {
        const expected = Math.sign(i - j);
        expect(Math.sign(compare(ordered[i] ?? '', ordered[j] ?? ''))).toBe(expected);
      }
    }
  });

  it('compare les identifiants numériques par valeur (beta.2 < beta.11)', () => {
    expect(compare('1.0.0-beta.2', '1.0.0-beta.11')).toBeLessThan(0);
    expect(compare('1.0.0-beta.11', '1.0.0-beta.2')).toBeGreaterThan(0);
  });

  it('place les identifiants numériques avant les alphanumériques', () => {
    expect(compare('1.0.0-1', '1.0.0-alpha')).toBeLessThan(0);
    expect(compare('1.0.0-alpha.1', '1.0.0-alpha.beta')).toBeLessThan(0);
    expect(compare('1.0.0-alpha.beta', '1.0.0-alpha.1')).toBeGreaterThan(0);
  });

  it('compare les identifiants alphanumériques en ordre ASCII', () => {
    expect(compare('1.0.0-alpha', '1.0.0-beta')).toBeLessThan(0);
    expect(compare('1.0.0-Beta', '1.0.0-alpha')).toBeLessThan(0); // majuscule avant minuscule
    expect(compare('1.0.0-rc', '1.0.0-rc1')).toBeLessThan(0);
    expect(compare('1.0.0-a-b', '1.0.0-a')).toBeGreaterThan(0);
  });

  it('un jeu plus long l’emporte quand le préfixe est égal', () => {
    expect(compare('1.0.0-alpha', '1.0.0-alpha.1')).toBeLessThan(0);
    expect(compare('1.0.0-alpha.1', '1.0.0-alpha')).toBeGreaterThan(0);
    expect(compare('1.0.0-1.2', '1.0.0-1.2.3')).toBeLessThan(0);
  });

  it('ignore les métadonnées de build', () => {
    expect(compare('1.0.0+a', '1.0.0+b')).toBe(0);
    expect(compare('1.0.0+build.1', '1.0.0')).toBe(0);
    expect(compare('1.0.0-beta+x', '1.0.0-beta+y')).toBe(0);
    expect(compare('1.0.1+a', '1.0.0+z')).toBeGreaterThan(0);
  });

  it('est antisymétrique et transitif sur un échantillon', () => {
    const sample = [
      '0.0.0-dev',
      '0.1.0',
      '1.0.0-beta.1',
      '1.0.0-beta.2',
      '1.0.0',
      '1.0.1',
      '1.1.0-rc.1',
      '1.1.0',
    ];
    for (const a of sample)
      for (const b of sample) {
        expect(Math.sign(compare(a, b))).toBe(0 - Math.sign(compare(b, a)));
        for (const c of sample)
          if (compare(a, b) <= 0 && compare(b, c) <= 0) expect(compare(a, c)).toBeLessThanOrEqual(0);
      }
  });

  it('trie une liste mélangée', () => {
    const shuffled = ['v1.10.0', '1.2.0-beta.1', '1.2.0', '1.9.0', 'v1.2.0-alpha', '0.9.9'];
    expect([...shuffled].sort(compare)).toEqual([
      '0.9.9',
      'v1.2.0-alpha',
      '1.2.0-beta.1',
      '1.2.0',
      '1.9.0',
      'v1.10.0',
    ]);
  });

  it('range une version illisible avant toute version valide', () => {
    expect(compare('n’importe quoi', '0.0.0')).toBeLessThan(0);
    expect(compare('0.0.0', 'n’importe quoi')).toBeGreaterThan(0);
    expect(compare('abc', 'def')).toBe(0);
  });
});

describe('isNewer', () => {
  it('détecte une version plus récente', () => {
    expect(isNewer('1.2.1', '1.2.0')).toBe(true);
    expect(isNewer('v2.0.0', '1.9.9')).toBe(true);
    expect(isNewer('1.2.0', '1.2.0-beta.1')).toBe(true);
    expect(isNewer('1.2.0-beta.2', '1.2.0-beta.1')).toBe(true);
    expect(isNewer('9.9.9', '0.0.0-dev')).toBe(true);
    expect(isNewer('0.0.1', '0.0.0-dev')).toBe(true);
  });

  it('ne propose ni la même version ni une plus ancienne', () => {
    expect(isNewer('1.2.0', '1.2.0')).toBe(false);
    expect(isNewer('v1.2.0', '1.2.0')).toBe(false);
    expect(isNewer('1.2.0-beta.1', '1.2.0')).toBe(false);
    expect(isNewer('1.1.9', '1.2.0')).toBe(false);
    expect(isNewer('1.2.0+b2', '1.2.0+b1')).toBe(false);
  });

  it('ne propose rien quand une version est illisible', () => {
    expect(isNewer('nightly', '1.0.0')).toBe(false);
    expect(isNewer('1.0.0', 'inconnue')).toBe(false);
  });
});

describe('format et isPrerelease', () => {
  it('produit la forme canonique', () => {
    expect(format(parse('v1.2.3+abc') ?? { major: 0, minor: 0, patch: 0, pre: [], build: [] })).toBe('1.2.3');
    expect(format(parse('1.2.3-beta.1+x') ?? { major: 0, minor: 0, patch: 0, pre: [], build: [] })).toBe(
      '1.2.3-beta.1',
    );
  });

  it('reconnaît les pré-versions', () => {
    expect(isPrerelease(parse('1.0.0-rc.1') ?? { major: 0, minor: 0, patch: 0, pre: [], build: [] })).toBe(
      true,
    );
    expect(isPrerelease(parse('1.0.0+build') ?? { major: 0, minor: 0, patch: 0, pre: [], build: [] })).toBe(
      false,
    );
  });

  it('compareParsed est cohérent avec compare', () => {
    const a = parse('1.0.0-beta');
    const b = parse('1.0.0');
    expect(a && b && compareParsed(a, b)).toBe(-1);
  });
});

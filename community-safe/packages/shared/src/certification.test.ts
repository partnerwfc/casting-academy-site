import { describe, expect, it } from 'vitest';
import { containsCode, isPrivateIp, normalizeForMatch, parseDohTxt, twitchDescription, youtubeChannelUrl, youtubeDescription } from './certification';

const CODE = 'SMC-7KQM-X2PA';

describe('containsCode', () => {
  it('retrouve le code dans une bio, malgré la casse, les espaces et les caractères invisibles', () => {
    expect(containsCode(`Créatrice ✨ vérifie-moi : ${CODE} · merci`, CODE)).toBe(true);
    expect(containsCode('smc-7kqm-x2pa', CODE)).toBe(true);
    expect(containsCode('SMC 7KQM X2PA', CODE)).toBe(true);
    expect(containsCode('SMC‑​7KQM–X2PA', CODE)).toBe(true);
  });
  it('refuse un code différent, partiel ou un texte vide', () => {
    expect(containsCode('SMC-7KQM-X2PB', CODE)).toBe(false);
    expect(containsCode('SMC-7KQM', CODE)).toBe(false);
    expect(containsCode('', CODE)).toBe(false);
    expect(containsCode(null, CODE)).toBe(false);
  });
  it('refuse un « code » qui n\'a pas le bon format (jamais de correspondance sur du texte libre)', () => {
    expect(containsCode('julie', 'julie')).toBe(false);
    expect(containsCode('SMC-0000-1111', 'SMC-0000-1111')).toBe(false); // 0 et 1 n'existent pas dans l'alphabet
  });
  it('normalise', () => expect(normalizeForMatch(' cs–ab ')).toBe('CSAB'));
});

describe('parseDohTxt', () => {
  it('extrait les valeurs TXT', () => {
    expect(parseDohTxt({ Answer: [{ type: 16, data: '"SMC-7KQM-X2PA"' }, { type: 5, data: 'autre.' }] })).toEqual(['SMC-7KQM-X2PA']);
    expect(parseDohTxt({ Answer: [{ type: 16, data: '"SMC-7KQM-" "X2PA"' }] })).toEqual(['SMC-7KQM-X2PA']);
    expect(parseDohTxt(null)).toEqual([]);
  });
});

describe('isPrivateIp', () => {
  it('bloque le réseau interne', () => {
    for (const ip of ['127.0.0.1', '10.0.0.5', '192.168.1.1', '172.16.0.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fe80::1', 'fd00::1', 'abc']) expect(isPrivateIp(ip)).toBe(true);
  });
  it('laisse passer les adresses publiques', () => {
    for (const ip of ['8.8.8.8', '151.101.1.1', '172.32.0.1', '2606:4700::1111']) expect(isPrivateIp(ip)).toBe(false);
  });
});

describe('API officielles', () => {
  it('lit la description YouTube et Twitch', () => {
    expect(youtubeDescription({ items: [{ snippet: { description: `hello ${CODE}` } }] })).toContain(CODE);
    expect(youtubeDescription({ items: [] })).toBeNull();
    expect(twitchDescription({ data: [{ description: CODE }] })).toBe(CODE);
    expect(youtubeChannelUrl('julie', 'KEY')).toBe('https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=%40julie&key=KEY');
  });
});

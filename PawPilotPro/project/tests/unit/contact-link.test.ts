import { describe, it, expect } from 'vitest';
import './setup';
import { phoneHref } from '../../src/app/modules/customers/components/contactHref';

// Pins the tel: normalisation used by ContactLink: display formatting is
// stripped and national numbers are internationalised with the organisation
// dial code (the format AddContactModal's placeholder advertises).
describe('phoneHref', () => {
  it('strips spaces and punctuation from formatted numbers', () => {
    expect(phoneHref('+44 7700 900123', '+44')).toBe('+447700900123');
    expect(phoneHref('(020) 7946-0999', '+44')).toBe('+442079460999');
  });

  it('keeps an existing international prefix regardless of org dial code', () => {
    expect(phoneHref('+353 1 234 5678', '+44')).toBe('+35312345678');
  });

  it('converts the 00 international prefix to +', () => {
    expect(phoneHref('00353 1 234 5678', '+44')).toBe('+35312345678');
  });

  it('swaps a national trunk 0 for the org dial code', () => {
    expect(phoneHref('07700 900123', '+44')).toBe('+447700900123');
  });

  it('prefixes the org dial code when no trunk 0 is present', () => {
    expect(phoneHref('555 123 4567', '+1')).toBe('+15551234567');
  });
});

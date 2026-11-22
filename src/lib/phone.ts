import { parsePhoneNumberFromString } from 'libphonenumber-js'

export function normalizePhone(raw: string, defaultCountry: 'PK' = 'PK') {
  const parsed = parsePhoneNumberFromString(raw, defaultCountry)
  if (!parsed || !parsed.isValid()) {
    return { normalized: null as string | null, valid: false }
  }
  return { normalized: parsed.number, valid: true }
}
import { describe, expect, it } from 'vitest'
import {
  CREDENTIAL_RECORD_ID,
  CredentialVault,
  type CredentialRecord,
  type CredentialStore,
} from './credentialVault'

function fakeStore(): CredentialStore & { records: Map<string, CredentialRecord> } {
  const records = new Map<string, CredentialRecord>()
  return {
    records,
    get: async (id) => records.get(id),
    put: async (record) => { records.set(record.id, record) },
    delete: async (id) => { records.delete(id) },
  }
}

describe('dedicated credential vault', () => {
  it('saves only in the injected credential store and exposes only an indicator', async () => {
    const store = fakeStore()
    const vault = new CredentialVault(store)
    const secret = ['owner', 'project', 'credential', '1234'].join('-')
    expect(await vault.save(secret)).toEqual({ configured: true, lastFour: '1234' })
    expect(await vault.indicator()).toEqual({ configured: true, lastFour: '1234' })
    expect(store.records.get(CREDENTIAL_RECORD_ID)?.value).toBe(secret)
  })

  it('replaces and removes the single dedicated record', async () => {
    const store = fakeStore()
    const vault = new CredentialVault(store)
    await vault.save('first-value')
    await vault.save('replacement-5678')
    expect(await vault.withCredential(async (value) => value)).toBe('replacement-5678')
    await vault.remove()
    expect(await vault.indicator()).toEqual({ configured: false })
    await expect(vault.withCredential(async () => true)).rejects.toThrow('credential-not-configured')
  })
})


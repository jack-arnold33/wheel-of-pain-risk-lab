export const CREDENTIAL_RECORD_ID = 'openai-project-key'

export interface CredentialRecord {
  id: typeof CREDENTIAL_RECORD_ID
  value: string
  lastFour: string
}

export interface CredentialStore {
  get(id: typeof CREDENTIAL_RECORD_ID): Promise<CredentialRecord | undefined>
  put(record: CredentialRecord): Promise<void>
  delete(id: typeof CREDENTIAL_RECORD_ID): Promise<void>
}

export interface CredentialIndicator {
  configured: boolean
  lastFour?: string
}

export class CredentialVault {
  constructor(private readonly store: CredentialStore) {}

  async indicator(): Promise<CredentialIndicator> {
    const record = await this.store.get(CREDENTIAL_RECORD_ID)
    return record ? { configured: true, lastFour: record.lastFour } : { configured: false }
  }

  async save(value: string): Promise<CredentialIndicator> {
    const normalized = value.trim()
    if (!normalized) throw new Error('empty-credential')
    const lastFour = normalized.slice(-4)
    await this.store.put({ id: CREDENTIAL_RECORD_ID, value: normalized, lastFour })
    return { configured: true, lastFour }
  }

  async withCredential<T>(use: (value: string) => Promise<T>): Promise<T> {
    const record = await this.store.get(CREDENTIAL_RECORD_ID)
    if (!record) throw new Error('credential-not-configured')
    return use(record.value)
  }

  async remove() {
    await this.store.delete(CREDENTIAL_RECORD_ID)
  }
}


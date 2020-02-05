import { Document, Result, DocClass, IDBCore } from './DBMeta.ts'

export { Document, Result, DocClass }

export type BalType = 'bal=' | 'bal+' | 'bal-'

export interface Balance {
    type: BalType, 
    key: string, 
    id?: string, 
    from?: string,
    qty: number,
    val: number,
}

export interface IERPCore extends IDBCore {
    balkey_from_ids(type: BalType, ids: string[]): string
    get_bal_by_key(key: string): Balance
    get_bal(type: BalType, ids: string[]): Balance
    recreate_bals(): void
}

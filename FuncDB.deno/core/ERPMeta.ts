import { Document, Result, DocClass, IDBCore } from './DBMeta.ts'

export { Document, Result, DocClass }

export interface Balance {
    type?: string, 
    key: string, 
    id?: string, 
    from?: string,
    qty: number, // остаток в наличии
    val: number,
    iqty: number, // ожидаемый приход
    ival: number,
    oqty: number, // ожидаемый расход
    oval: number,
}

export interface IERPCore extends IDBCore {
    get_bal(ids: string[]): Balance
    get_bal_by_key(key: string): Balance
    balkey_from_ids(ids: string[]): string
}

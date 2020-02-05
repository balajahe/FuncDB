export type Document = any
export type Result = any

export const enum DBMeta {
    data_immut = 'data_immut_001.json',
    data_current = 'data_current.json',
    delim = 1,
    cache_doc = 'cache_doc.json',
    cache_top = 'cache_top.json',
    cache_reduce = 'cache_reduce.json'
}

export abstract class DocClass {
    static cache_doc = false
    static cache_top = false
    static on_add(doc: Document, db: IDBCore): [boolean, string?] { return [true,] }
}

export interface IDBCore {
    reduce(
        filter: (result: Result, doc: Document) => boolean, 
        reducer: (result: Result, doc: Document) => void,
        result: Result,
        to_cache?: boolean,
    ): Result
    reduce_top(
        filter: (result: Result, doc: Document) => boolean, 
        reducer: (result: Result, doc: Document) => void,
        result: Result,
    ): Result
    map_current(
        mapper: (doc: Document) => void
    ): void
    get(id: string, allow_scan?: boolean): Document | undefined
    get_top(key: string, allow_scan?: boolean): Document | undefined
    add(doc: Document): [boolean, string?]
    doc_class(type: string): DocClass
    key_from_id(id: string): string
    tran_begin(): void
    tran_commit(): void
    tran_rollback(): void
    flush_sync(and_cache?: boolean, compact?: boolean, snapshot?: string): void
    flush_async(and_cache?: boolean, compact?: boolean, snapshot?: string): Promise<void>
}

export interface IDBLogger {
    inc_total(): void
    inc_parseerror(): void
    inc_typeerror(): void
    inc_processed() : void
    inc_processed1() : void
    inc_processerror() : void
    print_progress(): void
}

export type Document = any
export type Accumulator = any

export const enum DBMeta {
    data_immut = 'data_immut_001.json',
    data_current = 'data_current.json',
    delim = 1,
    cache_doc = 'cache_doc.json',
    cache_top = 'cache_top.json',
    cache_reduce = 'cache_reduce.json',
    snapshots = 'snapshots/',
}

export abstract class DocClass {
    static cache_doc = false
    static cache_top = false
    static on_add(doc: Document, db: IDBCore): [boolean, string?] { return [true,] }
}

export interface IDBCore {
    reduce(
        filter: (accum: Accumulator, doc: Document) => boolean, 
        reducer: (accum: Accumulator, doc: Document) => void,
        accum: Accumulator,
        to_cache?: boolean,
    ): Accumulator
    reduce_top(
        filter: (accum: Accumulator, doc: Document) => boolean, 
        reducer: (accum: Accumulator, doc: Document) => void,
        accum: Accumulator,
    ): Accumulator
    recreate_current(
        creator: (accum: Accumulator, doc: Document) => void,
        accum: Accumulator
    ): void
    get(id: string, allow_scan?: boolean): Document | undefined
    get_top(key: string, allow_scan?: boolean): Document | undefined
    add(doc: Document): [boolean, string?]

    doc_class(type: string): DocClass
    key_from_id(id: string): string
    ts_from_id(id: string): string
    gen_id(key: string): string

    tran_begin(): void
    tran_commit(): void
    tran_rollback(): void
    flush_sync(and_cache?: boolean, compact?: boolean, snapshot?: string): void
    flush_async(and_cache?: boolean, compact?: boolean, snapshot?: string): Promise<void>
    log?: IDBLog
}

export interface IDBLog {
    inc_total(): void
    inc_parseerror(): void
    inc_typeerror(): void
    inc_processed() : void
    inc_processed1() : void
    inc_processerror() : void
    print_progress(): void
}

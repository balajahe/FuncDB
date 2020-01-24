export type Document = any
export type Result = any

export const enum DBMeta {
    data_immut = 'data_immut_001.json',
    data_mut_current = 'data_mut_current.json',
    delim = 1,
    cache_doc = 'cache_doc.json',
    cache_top = 'cache_top.json',
    cache_reduce = 'cache_reduce.json'
}

export abstract class DocMeta {
    static cache_doc = false
    static cache_top = false

    static before_del(doc: Document, db: IDBCore): [boolean, string?] { return [true,] }
    static after_del(doc: Document, db: IDBCore): void {}

    static before_add(doc: Document, db: IDBCore): [boolean, string?] { return [true,] }
    static after_add(doc: Document, db: IDBCore): void {}
}

export interface IDBCore {
    reduce(
        filter: (result: Result, doc: Document) => boolean, 
        reducer: (result: Result, doc: Document) => void,
        result: Result,
        no_cache?: boolean,
    ): Result;
    get(id: string, no_scan?: boolean): Document | undefined
    get_top(key: string, no_scan?: boolean): Document | undefined
    add_mut(doc: Document): [boolean, string?]
    doc_meta(type: string): DocMeta
    key_from_id(id: string): string
    flush(no_cache?: boolean, compact?: boolean): void
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

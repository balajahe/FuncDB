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

export abstract class DocClass {
    static cache_doc = false
    static cache_top = false

    static attach(doc: Document): void {
        doc.sys.cache_doc = this.cache_doc
        doc.sys.cache_top = this.cache_top

        doc.sys.before_del = this.before_del
        doc.sys.after_del = this.after_del

        doc.sys.before_add = this.before_add
        doc.sys.after_add = this.after_add
    }

    static before_del(doc: Document, db: IDBCore): boolean { return true }
    static after_del(doc: Document, db: IDBCore): void {}

    static before_add(doc: Document, db: IDBCore): boolean { return true }
    static after_add(doc: Document, db: IDBCore): void {}
}

export interface IDBCore {
    reduce(
        filter: (result: Result, doc: Document) => boolean, 
        reducer: (result: Result, doc: Document) => void,
        result: Result
    ): Result;
    get(id: string): Document | false;
    get_top(code: string): Document | false;
    code_from_id(id: string): string;
    add_mut(doc: Document): string | false;
}

export interface IDBLogger {
    inc_total(): void
    inc_parsed(): void
    inc_classified(): void
    inc_processed() : void
    inc_processed1() : void
    inc_processerror() : void
}

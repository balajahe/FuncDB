export type Document = any
export type Result = any

export const enum DBMeta {
    data_immut = 'data_immut_001.json',
    data_mut = 'data_mut_current.json',
    cache_doc_full = 'cache_doc_full.json',
    cache_doc_top = 'cache_doc_top.json',
    cache_reduce = 'cache_reduce.json',
    delim = 1
}

export abstract class DocClass {
    static cache = false

    static attach(doc: Document): Document {
        doc.sys.cache = this.cache
        doc.sys.before_del = this.before_del
        doc.sys.after_del = this.after_del
        doc.sys.before_add = this.before_add
        doc.sys.after_add = this.after_add
        return doc
    }

    static before_del(doc: Document): boolean { return true }
    static after_del(doc: Document): void {}

    static before_add(doc: Document): boolean { return true }
    static after_add(doc: Document): void {}
}

export interface DBLogger {
    inc_total(): void
    inc_parsed(): void
    inc_classified(): void
    inc_processed() : void
}

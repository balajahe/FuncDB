export type Document = any
export type Result = any

export const enum DBMeta {
    immut_data_file = 'immut_001.json',
    mut_data_file = 'mut_data.json',
    immut_cache_file = 'immut_cache.json',
    top_cache_file = 'top_cache.json',
    delim = 1
}

export abstract class DocClass {
    static cache = false

    static attach(doc: Document): void {
        doc.sys.cache = this.cache
        doc.sys.before_del = this.before_del
        doc.sys.after_del = this.after_del
        doc.sys.before_add = this.before_add
        doc.sys.after_add = this.after_add
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

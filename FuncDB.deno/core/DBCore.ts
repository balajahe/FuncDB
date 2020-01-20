import { Document, Result, DBMeta, DocClass, DBLogger } from './DBMeta.ts'
import { DBReaderSync } from './DBIO.ts'
import get_doc_class from '../doc_classes/.get_doc_class.ts'

export class DBCore {
    private dbpath: string
    private mut_current = new Map<string, Document>()
    private cache_doc_full = new Map<string, Document>()
    private cache_doc_top = new Map<string, Document>()
    private cache_reduce = new Map<string, Result>()

    private constructor(dbpath) { 
        this.dbpath = dbpath 
    }

    static open(dbpath: string): DBCore {
        const db = new DBCore(dbpath)
        db.init()
        return db
    }
   
    private init() {
        console.log('\ndatabase initialization started...')

        let db = new DBIterator(this.dbpath + DBMeta.data_immut, 'init')
        for (let doc = db.next(); doc; doc = db.next()) {
            if (doc.sys.cache) {
                this.cache_doc_full.set(doc.sys.id, doc)
                this.cache_doc_top.set(doc.sys.code, doc)
                db.log.inc_processed()
            }
        }
        db.log.write()

        db = new DBIterator(this.dbpath + DBMeta.data_mut, 'init')
        for (let doc = db.next(); doc; doc = db.next()) {
            this.mut_current.set(doc.sys.id, doc)
        }
        db.log.write()

        console.log('\ndatabase is initialized !')
    }

    reduce(
        filter: (result: Result, doc: Document) => boolean, 
        reducer: (result: Result, doc: Document) => void,
        result: Result
    ): Result {
        console.log('\nreduce() started...')
        const key = filter.toString() + reducer.toString() + JSON.stringify(result)
        const cached = this.cache_reduce.get(key)
        if (cached !== undefined) {
            result = JSON.parse(cached)
        } else {
            this.reduce1(DBMeta.data_immut, filter, reducer, result)
            this.cache_reduce.set(key, JSON.stringify(result))
        }
        this.reduce1(DBMeta.data_mut, filter, reducer, result)
        return result
    }

    private reduce1(
        fname: string,
        filter: (result: Result, doc: Document) => boolean, 
        reducer: (result: Result, doc: Document) => void,
        result: Result
    ): Result {
        const db = new DBIterator(this.dbpath + fname, 'reduce')
        for (let doc = db.next(); doc; doc = db.next()) {
            try {
                if(filter(result, doc)) {
                    reducer(result, doc)
                    db.log.inc_processed()
                }
            } catch(e) {
                console.log(JSON.stringify(doc) + '\n' + e)
                db.log.inc_processerror()
            }
        }
        db.log.write()
        return result
    }

    get(id: string): Document | undefined {
        const cached = this.cache_doc_full.get(id)
        if (cached !== undefined) {
            return cached
        } else {
            const curr = this.mut_current.get(id)
            if (curr !== undefined) {
                return curr
            } else {
                const doc = this.get1(DBMeta.data_immut, id)
                if (doc !== undefined) {
                    this.cache_doc_full.set(id, doc)
                    return doc
                } else {
                    return undefined
                }
            }
        }
    }

    private get1(fname: string, id: string): Document | undefined {
        const db = new DBReaderSync(this.dbpath + fname)
        for (let doc = db.next(); doc; doc = db.next()) {
            if (doc.sys.id === id) {
                return attach_doc_class(doc)
            }
        }
    }

    gettop(code: string): Document | undefined {
        let cached = this.cache_doc_top.get(code)
        if (cached !== undefined) {
            return cached
        } else {
            this.gettop1(DBMeta.data_immut, code)
            this.gettop1(DBMeta.data_mut, code)
            return this.cache_doc_top.get(code)
        }
    }

    private gettop1(fname: string, code: string): void {
        const db = new DBReaderSync(this.dbpath + fname)
        for (let doc = db.next(); doc; doc = db.next()) {
            if (doc.sys.code === code) {
                attach_doc_class(doc)
                this.cache_doc_top.set(code, doc)
            }
        }
    }

/*
    public add_immut(doc: Document) {
        const sys = doc.sys
        sys.ts = Date.now()
        sys.id = sys.code + '^' + sys.ts
        const dbf = Deno.openSync(this.dbpath + DBMeta.immut_file, 'a')
        dbf.writeSync(new TextEncoder().encode(JSON.stringify(doc) + DBMeta.immut_delim))
        dbf.close()
        this.top_cache.set(sys.code, doc)
    }

    private write_cache(cache: any) {
        const f = Deno.openSync(this.dbpath + DBMeta., "a")
        f.writeSync(new TextEncoder().encode(cache + '\n'))
        f.close()
    }
*/
}

class DBIterator {
    private from_file: boolean
    private db: DBReaderSync
    private mm: Map<string, Document>
    public readonly log: Log

    constructor(source: string | Map<string, Document>, logmode: string) {
        if (typeof source === 'string') {
            this.from_file = true
            this.log = new Log(source, logmode)
            this.db = new DBReaderSync(source, this.log)
        } else {
            this.from_file = false
        }
    }

    next(): Document | false {
        switch (this.from_file) {
            case true:
                let doc = this.db.next()
                if (!doc) return false
                try {
                    attach_doc_class(doc)
                    this.log.inc_classified()
                    this.log.print_progress()
                    return doc
                } catch(e) {
                    console.log(JSON.stringify(doc) + '\n' + e)
                    return this.next()
                }
            case false:
                return false
        }
    }
}

function attach_doc_class(doc: Document): Document {
    return get_doc_class(doc.sys.class).attach(doc)
}

class Log implements DBLogger {
    readonly outcou = 10000
    readonly start = Date.now()
    fname = ''
    outmode = ''
    total = 0
    parsed = 0
    classified = 0
    processed = 0
    processerror = 0
    cou = 0
    constructor(fname, outmode) {
        this.fname = fname 
        this.outmode = outmode
    }
    inc_total() { this.total++;  this.cou++ }
    inc_parsed() { this.parsed++ }
    inc_classified() { this.classified++ }
    inc_processed() { this.processed++ }
    inc_processerror() { this.processerror++ }
    print_progress() {
        if (this.cou === this.outcou) {
            this.write()
            console.log('\x1b[8A') 
            this.cou = 0
        }
    }
    write() {
        const elapsed = (Date.now() - this.start) / 1000
        switch (this.outmode) {
            case 'init': {
                console.log(`
                    file: ${this.fname}
                    ${this.total} chunks discovered
                    ${this.parsed} objs parsed \x1b[31m(${this.total - this.parsed}\x1b[0m JSON errors)
                    ${this.classified} docs classified \x1b[31m(${this.parsed - this.classified}\x1b[0m DocClass errors)
                    ${this.processed} docs cached
                    ${elapsed}s elapsed`
                )
                break
            }
            case 'reduce': {
                console.log(`
                    file: ${this.fname}
                    ${this.total} docs discovered
                    ${this.parsed} objs parsed \x1b[31m(${this.total - this.parsed}\x1b[0m JSON errors)
                    ${this.classified} docs classified \x1b[31m(${this.parsed - this.classified}\x1b[0m DocSysClass errors)
                    ${this.processed} docs processed \x1b[31m(${this.processerror}\x1b[0m BL errors)
                    ${elapsed}s elapsed`
                )
                break
            }
        }    
    }
}

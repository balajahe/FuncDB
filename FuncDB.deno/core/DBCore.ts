import { Document, Result, DBMeta, DocClass, DBLogger } from './DBMeta.ts'
import { DBReaderSync, DBReaderAsync } from './DBIO.ts'
import get_doc_class from '../doc_classes/.get_doc_class.ts'

export class DBCore {
    private dbpath: string
    //private doc_sys_classes = new Map<string, DocClass>()
    private mut_data = new Map<string, Document>()
    private immut_cache = new Map<string, Result>()
    private top_cache = new Map<string, Document>()
    private log: Log

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
        this.log = new Log(DBMeta.immut_data_file, 'init')
        const db = new DBReaderSync(this.dbpath + DBMeta.immut_data_file, this.log)
        for (let doc = db.get_sync(); doc; doc = db.get_sync()) {
            try {
                this.attach_doc_class(doc)
                this.log.inc_classified()
                if (doc.sys.cache) {
                    this.immut_cache.set(doc.sys.id, doc)
                    this.top_cache.set(doc.sys.code, doc)
                    this.log.inc_processed()
                }
            } catch(e) {
                console.log(JSON.stringify(doc) + '\n' + e)
            }
            this.log.print_progress()
        }
        this.log.write()
        console.log('\ndatabase is initialized !')
    }

    reduce(
        filter: (result: Result, doc: Document) => boolean, 
        reducer: (result: Result, doc: Document) => void,
        result: Result
    ): Result {
        console.log('\nreduce() started...')
        const key = filter.toString() + reducer.toString() + JSON.stringify(result)
        const cached = this.immut_cache.get(key)
        if (cached !== undefined) {
            result = JSON.parse(cached)
        } else {
            this.reduce1(DBMeta.immut_data_file, filter, reducer, result)
            this.immut_cache.set(key, JSON.stringify(result))
            //this.write_cache(reducer)
        }
        this.reduce1(DBMeta.mut_data_file, filter, reducer, result)
        return result
    }

    private reduce1(
        fname: string,
        filter: (result: Result, doc: Document) => boolean, 
        reducer: (result: Result, doc: Document) => void,
        result: Result
    ): Result {
        this.log = new Log(fname, 'reduce')
        const db = new DBReaderSync(this.dbpath + fname, this.log)
        for (let doc = db.get_sync(); doc; doc = db.get_sync()) {
            try {
                this.attach_doc_class(doc)
                this.log.inc_classified()
                try {0
                    if(filter(result, doc)) {
                        reducer(result, doc)
                        this.log.inc_processed()
                    }
                } catch(e) {
                    console.log(JSON.stringify(doc) + '\n' + e)
                    this.log.inc_processerror()
                }
            } catch(e) {
                console.log(JSON.stringify(doc) + '\n' + e)
            }
            this.log.print_progress()
        }
        this.log.write()
        return result
    }

    get(id: string): Document | undefined {
        let cached = this.immut_cache.get(id)
        if (cached !== undefined) {
            return cached
        } else {
            const doc = this.get1(DBMeta.immut_data_file, id)
            if (doc !== undefined) {
                this.immut_cache.set(id, doc)
                return doc
            } else {
                return undefined //await this.get1(DBFile.Current, id)
            }
        }
    }

    private get1(fname: string, id: string): Document | undefined {
        const db = new DBReaderSync(this.dbpath + fname)
        for (let obj = db.get_sync(); obj; obj = db.get_sync()) {
            try {
                if (obj.sys.id === id) {
                    return obj
                }
            } catch(_) {}
        }
    }

    gettop(code: string): Document | undefined {
        let cached = this.top_cache.get(code)
        if (cached !== undefined) {
            return cached
        } else {
            this.gettop1(DBMeta.immut_data_file, code)
            //await this.gettop1(DBFile.Current, code)
            return this.top_cache.get(code)
        }
    }

    private gettop1(fname: string, code: string): void {
        const db = new DBReaderSync(this.dbpath + fname)
        for (let obj = db.get_sync(); obj; obj = db.get_sync()) {
            try {
                if (obj.sys.code === code) {
                    this.top_cache.set(code, obj)
                }
            } catch(_) {}
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
    private attach_doc_class(doc: Document): void {
        const cl = get_doc_class(doc.sys.class)
        cl.attach(doc)
    }
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

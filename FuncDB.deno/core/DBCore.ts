import { Document, Result, DBMeta, DocClass, IDBCore, IDBLogger } from './DBMeta.ts'
import { DBReaderSync, DBWriter } from './DBIO.ts'
import { get_doc_class } from '../doc_classes/.get_doc_class.ts'

export class DBCore implements IDBCore {
    private dbpath: string
    private mut_current = new Array<Document>()
    private cache_doc = new Map<string, Document>()
    private cache_top = new Map<string, Document>()
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

        let db = new DBReaderClassify(this.dbpath + DBMeta.data_immut, 'init')
        for (let doc = db.next(); doc; doc = db.next()) {
            this.to_cache(doc, db.log)
        }
        db.log.print()

        db = new DBReaderClassify(this.dbpath + DBMeta.data_mut_current, 'init')
        for (let doc = db.next(); doc; doc = db.next()) {
            this.to_cache(doc, db.log)
            this.mut_current.push(doc)
        }
        db.log.print()

        console.log('\ndatabase is initialized !')

    }

    reduce(
        filter: (result: Result, doc: Document) => boolean, 
        reducer: (result: Result, doc: Document) => void,
        result: Result,
    ): Result {
        const key = filter.toString() + ',\n' + reducer.toString() + ',\n' + JSON.stringify(result)
//        console.log('\nreduce() started...\n' + key)
        console.log('\nreduce() started...')
        const cached = this.cache_reduce.get(key)
        if (cached !== undefined) {
            console.log(`\n                    immutable part of result taken from cache`)
            result = JSON.parse(cached)
        } else {
            const db = new DBReaderClassify(this.dbpath + DBMeta.data_immut, 'reduce-file')
            for (let doc = db.next(); doc; doc = db.next()) {
                reduce1(doc, db.log)
            }
            db.log.print()
            this.cache_reduce.set(key, JSON.stringify(result))
        }
        const log = new Log('in-memory/mut_current', 'reduce-memory')
        for (let doc of this.mut_current.values()) {
            log.inc_total()
            reduce1(doc, log)
        }
        log.print()
        return result

        function reduce1(doc: Document, log?: Log) {
            try {
                if(filter(result, doc)) {
                    reducer(result, doc)
                    log?.inc_processed()
                }
            } catch(e) {
                console.log(JSON.stringify(doc, null, '\t') + '\n' + e.stack)
                Deno.exit()
                //log?.inc_processerror()
            }
        }
    }

    get(id: string): Document | undefined {
        const cached = this.cache_doc.get(id)
        if (cached !== undefined) {
            return cached
        } else {
            const db = new DBReaderClassify(this.dbpath + DBMeta.data_immut)
            for (let doc = db.next(); doc; doc = db.next()) {
                if (doc.sys.id === id) {
                    this.cache_doc.set(id, doc)
                    return doc
                }
            } 
            for (const doc of this.mut_current) {
                if (doc.sys.id === id) {
                    this.cache_doc.set(id, doc)
                    return doc
                }
            }
            return undefined
        }
    }

    get_top(code: string): Document | undefined {
        let cached = this.cache_top.get(code)
        if (cached !== undefined) {
            return cached
        } else {
            const db = new DBReaderClassify(this.dbpath + DBMeta.data_immut)
            for (let doc = db.next(); doc; doc = db.next()) {
                if (doc.sys.code === code) {
                    this.cache_top.set(code, doc)
                }
            }
            for (const doc of this.mut_current) {
                if (doc.sys.code === code) {
                    this.cache_top.set(code, doc)
                }
            }
            return this.cache_top.get(code)
        }
    }

    add_mut(doc: Document): true | string {
        try {
            if (doc.sys.id === undefined) doc.sys.id = doc.sys.code + '^' + Date.now()
            attach_doc_class(doc)
            const ok = doc.class.before_add(doc, this)
            if (ok === true) {
                this.to_cache(doc)
                this.mut_current.push(doc)
                doc.class.after_add(doc, this)
            }
            return ok
        } catch(e) {
            console.log(e)
            Deno.exit()
        }
    }

    code_from_id(id: string): string {
        return id.slice(0, id.indexOf('^'))
    }

    doc_class(classname: string): DocClass {
        return get_doc_class(classname)
    }

    flush(): void {
        const db = DBWriter.rewrite(this.dbpath + DBMeta.data_mut_current)
        for (const doc of this.mut_current.values()) {
            db.add(doc)
        }
        db.close()
        console.log('\nmut_current data written to disk !')
    }

    private to_cache(doc: Document, log?: Log) {
        if (doc.class.cache_doc) {
            this.cache_doc.set(doc.sys.id, doc)
            log?.inc_processed()
        }
        if (doc.class.cache_top) {
            this.cache_top.set(doc.sys.code, doc)
            log?.inc_processed1()
        }
    }
}

class DBReaderClassify {
    private db: DBReaderSync
    readonly log?: Log

    constructor(fpath: string, logmode?: string) {
        if (logmode !== null) this.log = new Log(fpath, logmode)
        this.db = new DBReaderSync(fpath, this.log)
    }

    next(): Document | false {
        let doc = this.db.next()
        if (!doc) return false
        try {
            attach_doc_class(doc)
            this.log?.inc_classified()
            this.log?.print_progress()
            return doc
        } catch(e) {
            console.log(JSON.stringify(doc, null, '\t') + '\n' + e)
            Deno.exit()
            //return this.next()
        }
    }
}

function attach_doc_class(doc: Document): void {
    doc.class = get_doc_class(doc.sys.class)
}

class Log implements IDBLogger {
    readonly printcou = 10000
    readonly start = Date.now()
    source = ''
    printmode = ''
    total = 0
    parsed = 0
    classified = 0
    processed = 0
    processed1 = 0
    processerror = 0
    cou = 0
    constructor(source: string, printmode: string) {
        this.source = source 
        this.printmode = printmode
    }
    inc_total() { this.total++;  this.cou++ }
    inc_parsed() { this.parsed++ }
    inc_classified() { this.classified++ }
    inc_processed() { this.processed++ }
    inc_processed1() { this.processed1++ }
    inc_processerror() { this.processerror++ }
    print_progress() {
        if (this.cou === this.printcou) {
            const lines = this.print()
            this.cou = 0
            console.log('\x1b[' + lines + 'A') 
        }
    }
    print(): number {
        const elapsed = (Date.now() - this.start) / 1000
        switch (this.printmode) {
            case 'init':
                console.log(`
                    source: "${this.source}"
                    ${this.total} docs discovered
                    ${this.parsed} docs parsed \x1b[31m(${this.total - this.parsed}\x1b[0m JSON errors)
                    ${this.classified} docs classified \x1b[31m(${this.parsed - this.classified}\x1b[0m DocClass errors)
                    ${this.processed} docs placed in doc-cache
                    ${this.processed1} docs placed in top-cache
                    ${elapsed}s elapsed`
                )
                return 9
            case 'reduce-file':
                console.log(`
                    source: "${this.source}"
                    ${this.total} docs discovered
                    ${this.parsed} docs parsed \x1b[31m(${this.total - this.parsed}\x1b[0m JSON errors)
                    ${this.classified} docs classified \x1b[31m(${this.parsed - this.classified}\x1b[0m DocClass errors)
                    ${this.processed} docs processed \x1b[31m(${this.processerror}\x1b[0m BL errors)
                    ${elapsed}s elapsed`
                )
                return 8
            case 'reduce-memory':
                console.log(`
                    source: "${this.source}"
                    ${this.total} docs discovered
                    ${this.processed} docs processed \x1b[31m(${this.processerror}\x1b[0m BL errors)
                    ${elapsed}s elapsed`
                )
                return 6
        }    
    }
}

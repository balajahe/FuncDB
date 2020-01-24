import { Document, Result, DBMeta, DocClass, IDBCore, IDBLogger } from './DBMeta.ts'
import { IDBReader, DBReaderSync, DBWriterSync } from './DBIO.ts'
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

    static open(dbpath: string, no_cache: boolean = false): DBCore {
        const db = new DBCore(dbpath)
        db.init()
        return db
    }
   
    private init(no_cache: boolean = false) {
        console.log('\ndatabase initialization started...')

        if (!no_cache) {
            try {
                Deno.openSync(this.dbpath + DBMeta.cache_doc, 'r').close()
                Deno.openSync(this.dbpath + DBMeta.cache_top, 'r').close()
                Deno.openSync(this.dbpath + DBMeta.cache_reduce, 'r').close()
            } catch(_) {
                no_cache = true
            }
        }
        if (!no_cache) {
            let db = new DBReaderClassify(this.dbpath + DBMeta.cache_doc, 'cache')
            for (let doc = db.next(); doc; doc = db.next()) {
                this.cache_doc.set(doc.sys.id, doc)
            }
            db.log.print_final()

            db = new DBReaderClassify(this.dbpath + DBMeta.cache_top, 'cache')
            for (let doc = db.next(); doc; doc = db.next()) {
                this.cache_top.set(doc.sys.code, doc)
            }
            db.log.print_final()

            const log = new Log(this.dbpath + DBMeta.cache_reduce, 'cache')
            const db1 = new DBReaderSync(this.dbpath + DBMeta.cache_reduce, log)
            for (let red = db1.next(); red; red = db1.next()) {
                this.cache_reduce.set(red[0], red[1])
            }
            log.print_final()

        } else {
            const db = new DBReaderClassify(this.dbpath + DBMeta.data_immut, 'init')
            for (let doc = db.next(); doc; doc = db.next()) {
                this.to_cache(doc, db.log)
            }
            db.log.print_final()
        }

        const db = new DBReaderClassify(this.dbpath + DBMeta.data_mut_current, 'init')
        for (let doc = db.next(); doc; doc = db.next()) {
            this.to_cache(doc, db.log)
            this.mut_current.push(doc)
        }
        db.log.print_final()

        console.log('database is initialized !')
    }

    reduce(
        filter: (result: Result, doc: Document) => boolean, 
        reducer: (result: Result, doc: Document) => void,
        result: Result,
        no_cache: boolean = false,
    ): Result {
        const key = filter.toString() + ',\n' + reducer.toString() + ',\n' + JSON.stringify(result)
        console.log('\nreduce() started...')
        //console.log('\nreduce() started...\n' + key)
        const cached = this.cache_reduce.get(key)
        if (cached !== undefined) {
            console.log('    immutable part of result taken from cache')
            result = JSON.parse(cached)
        } else {
            const db = new DBReaderClassify(this.dbpath + DBMeta.data_immut, 'file')
            for (let doc = db.next(); doc; doc = db.next()) {
                reduce1(doc, db.log)
            }
            db.log.print_final()
            if (!no_cache) {
                this.cache_reduce.set(key, JSON.stringify(result))
            }
        }
        const log = new Log('in-memory/mut_current', 'memory')
        for (let doc of this.mut_current.values()) {
            log.inc_total()
            reduce1(doc, log)
        }
        log.print_final()
        return result

        function reduce1(doc: Document, log?: Log) {
            try {
                if(filter(result, doc)) {
                    reducer(result, doc)
                    log?.inc_processed()
                }
            } catch(e) {
                console.log(JSON.stringify(doc, null, '\t') + '\n' + e + '\n' + e.stack)
                log?.inc_processerror()
            }
        }
    }

    get(id: string, no_scan: boolean = false): Document | undefined {
        const cached = this.cache_doc.get(id)
        if (cached !== undefined) {
            return cached
        } else if (!no_scan) {
            console.log('\nget(' + id + ') started...')
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
        }
        return undefined
    }

    get_top(code: string, no_scan: boolean = false): Document | undefined {
        const cached = this.cache_top.get(code)
        if (cached !== undefined) {
            return cached
        } else if (!no_scan) {
            console.log('\nget_top(' + code + ') started...')
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
        } else {
            return undefined
        }
    }

    add_mut(doc: Document): [boolean, string?] {
        try {
            if (doc.sys.id === undefined) doc.sys.id = doc.sys.code + '^' + Date.now()
            attach_doc_class(doc)
            const [ok, msg] = doc.class.before_add(doc, this)
            if (ok) {
                this.mut_current.push(doc)
                this.to_cache(doc)
                doc.class.after_add(doc, this)
            }
            return [ok, msg]
        } catch(e) {
            console.log(JSON.stringify(doc, null, '\t') + '\n' + e + '\n' + e.stack)
            console.log('process is aborted !')
            Deno.exit()
        }
    }

    private to_cache(doc: Document, log?: Log) {
        if (doc.class.cache_doc) {
            if (!this.cache_doc.has(doc.sys.id)) log?.inc_processed()
            this.cache_doc.set(doc.sys.id, doc)
        }
        if (doc.class.cache_top) {
            if (!this.cache_top.has(doc.sys.code)) log?.inc_processed1()
            this.cache_top.set(doc.sys.code, doc)
        }
    }

    doc_class(classname: string): DocClass {
        return get_doc_class(classname)
    }

    code_from_id(id: string): string {
        return id.slice(0, id.indexOf('^'))
    }

    flush(no_cache: boolean = false) {
        let db = DBWriterSync.rewrite(this.dbpath + DBMeta.data_mut_current)
        for (const doc of this.mut_current.values()) {
            db.add(doc)
        }
        db.close()
        console.log('\nmut_current data written to disk !')

        if (!no_cache) {
            db = DBWriterSync.rewrite(this.dbpath + DBMeta.cache_doc)
            for (const doc of this.cache_doc.values()) {
                db.add(doc)
            }
            db.close()
            console.log('cache_doc written to disk !')

            db = DBWriterSync.rewrite(this.dbpath + DBMeta.cache_top)
            for (const doc of this.cache_top.values()) {
                db.add(doc)
            }
            db.close()
            console.log('cache_top written to disk !')

            db = DBWriterSync.rewrite(this.dbpath + DBMeta.cache_reduce)
            for (const entr of this.cache_reduce.entries()) {
                db.add(entr)
            }
            db.close()
            console.log('cache_reduce written to disk !')
        }
    }
}

class DBReaderClassify implements IDBReader {
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
            this.log?.print_progress()
            return doc
        } catch(e) {
            console.log(JSON.stringify(doc, null, '\t') + '\n' + e + '\n' + e.stack)
            this.log?.inc_classerror()
            return this.next()
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
    parseerror = 0
    classerror = 0
    processed = 0
    processed1 = 0
    processerror = 0
    cou = 0
    constructor(source: string, printmode: string) {
        this.source = source 
        this.printmode = printmode
    }
    inc_total() { this.total++;  this.cou++ }
    inc_parseerror() { this.parseerror++ }
    inc_classerror() { this.classerror++ }
    inc_processed() { this.processed++ }
    inc_processed1() { this.processed1++ }
    inc_processerror() { this.processerror++ }
    print_progress() {
        if (this.cou === this.printcou) {
            const lines = this.print_final()
            if (lines > 0) console.log('\x1b[' + lines + 'A')
            this.cou = 0
        }
    }
    print_final(): number {
        const elapsed = (Date.now() - this.start) / 1000
        switch (this.printmode) {
            case 'init':
                console.log(
`    ====== scan ====== "${this.source}"
    ${this.total} total (\x1b[31m${this.parseerror}\x1b[0m JSON errors, \x1b[31m${this.classerror}\x1b[0m class errors)
    ${this.processed} new docs placed in cache_doc
    ${this.processed1} new keys placed in cache_top
    ${elapsed}s elapsed`
                )
                return 6
            case 'file':
                console.log(
`    ====== scan ====== "${this.source}"
    ${this.total} total (\x1b[31m${this.parseerror}\x1b[0m JSON errors, \x1b[31m${this.classerror}\x1b[0m class errors)
    ${this.processed} docs processed \x1b[31m(${this.processerror}\x1b[0m reduce errors)
    ${elapsed}s elapsed`
                )
                return 5
            case 'cache':
                console.log(
`    ====== scan ====== "${this.source}"
    ${this.total} total (\x1b[31m${this.parseerror}\x1b[0m JSON errors, \x1b[31m${this.classerror}\x1b[0m class errors)
    ${elapsed}s elapsed`
                )
                return 4
            case 'memory':
                console.log(
`    ====== scan ====== "${this.source}"
    ${this.total} docs total
    ${this.processed} docs processed \x1b[31m(${this.processerror}\x1b[0m reduce errors)
    ${elapsed}s elapsed`
                )
                return 4
        }    
    }
}

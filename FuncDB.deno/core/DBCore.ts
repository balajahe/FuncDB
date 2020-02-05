import { Document, Result, DBMeta, DocClass, IDBCore, IDBLogger } from './DBMeta.ts'
import { IDBReader, DBReaderSync, DBWriterSync, DBWriterAsync } from './DBIO.ts'
import { get_doc_class } from '../doc_classes/.get_doc_class.ts'

export { Document, Result }

class Transaction {
    readonly current = new Array<Document>()
    readonly cache_doc = new Map<string, Document>()
    readonly cache_top = new Map<string, Document>()
    readonly cache_reduce = new Map<string, Result>()
}

class Data {
    readonly all = new Array<Transaction>()
    constructor() { this.all.push(new Transaction()) }
    get current(): Array<Document> { return this.all[this.all.length-1].current }
    get cache_doc(): Map<string, Document> { return this.all[this.all.length-1].cache_doc }
    get cache_top(): Map<string, Document> { return this.all[this.all.length-1].cache_top }
    get cache_reduce(): Map<string, Result> { return this.all[this.all.length-1].cache_reduce }
    tran_begin() { 
        this.all.push(new Transaction()) 
    }
    tran_commit() {
        if (this.all.length > 1) {
            const tran = this.all.pop()
            for (const val of tran.current) this.current.push(val)
            for (const [key, val] of tran.cache_doc.entries()) this.cache_doc.set(key, val)
            for (const [key, val] of tran.cache_top.entries()) this.cache_top.set(key, val)
            for (const [key, val] of tran.cache_reduce.entries()) this.cache_reduce.set(key, val)
        } else throw 'ERROR: Transaction is not started !'
    }
    tran_rollback() {
        if (this.all.length > 1) {
            this.all.pop()
        } else throw 'ERROR: Transaction is not started !'
    }
}

export class DBCore implements IDBCore {
    private dbpath: string
    private data = new Data()

    constructor(dbpath) { 
        this.dbpath = dbpath
        this.init()
    }

    private init(no_cache: boolean = false): DBCore {
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
            let db = new DBReaderWithClass(this.dbpath + DBMeta.cache_doc, 'cache')
            for (let doc = db.next(); doc; doc = db.next()) {
                this.data.cache_doc.set(doc.id, doc)
            }
            db.log.print_final()

            db = new DBReaderWithClass(this.dbpath + DBMeta.cache_top, 'cache')
            for (let doc = db.next(); doc; doc = db.next()) {
                this.data.cache_top.set(doc.key, doc)
            }
            db.log.print_final()

            const log = new Log(this.dbpath + DBMeta.cache_reduce, 'cache_reduce')
            const db1 = new DBReaderSync(this.dbpath + DBMeta.cache_reduce, log)
            for (let red = db1.next(); red; red = db1.next()) {
                this.data.cache_reduce.set(red[0], red[1])
            }
            log.print_final()

        } else {
            const db = new DBReaderWithClass(this.dbpath + DBMeta.data_immut, 'init')
            for (let doc = db.next(); doc; doc = db.next()) {
                this.to_cache(doc, db.log)
            }
            db.log.print_final()
        }

        const db = new DBReaderWithClass(this.dbpath + DBMeta.data_current, 'init')
        for (let doc = db.next(); doc; doc = db.next()) {
            this.to_cache(doc, db.log)
            this.data.current.push(doc)
        }
        db.log.print_final()

        console.log('database is initialized !')
        return this
    }

    reduce(
        filter: (result: Result, doc: Document) => boolean, 
        reducer: (result: Result, doc: Document) => void,
        result: Result,
        to_cache: boolean = true,
    ): Result {
        const key = filter.toString() + ',\n' + reducer.toString() + ',\n' + JSON.stringify(result)
        console.log('\nreduce() started...')
        //console.log('\nreduce() started...\n' + key)
        const cached = this.data.cache_reduce.get(key)
        if (cached !== undefined) {
            console.log('    immutable part of result taken from cache !')
            result = JSON.parse(cached)
        } else {
            const db = new DBReaderWithClass(this.dbpath + DBMeta.data_immut, 'file')
            for (let doc = db.next(); doc; doc = db.next()) {
                reduce1(doc, db.log)
            }
            db.log.print_final()
            if (to_cache) {
                this.data.cache_reduce.set(key, JSON.stringify(result))
            }
        }
        const log = new Log('in-memory/data_current', 'memory')
        for (const tran of this.data.all) {
            for (const doc of tran.current) {
                log.inc_total()
                reduce1(doc, log)
            }
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

    reduce_top(
        filter: (result: Result, doc: Document) => boolean, 
        reducer: (result: Result, doc: Document) => void,
        result: Result,
    ): Result {
        console.log('\nreduce_top() started...')
        const log = new Log('in-memory/cache_top', 'memory')
        for (let i = 0; i < this.data.all.length; i++) {
            for (let doc of this.data.all[i].cache_top.values()) {
                for (let j = i + 1; j < this.data.all.length; j++) { // ищем дубликаты в транзакциях ниже по стеку
                    const tran = this.data.all[j]
                    const doc1 = tran.cache_top.get(doc.key)
                    if (doc1 !== undefined) {
                        doc = doc1
                    }
                }
                log.inc_total()
                try {
                    if(filter(result, doc)) {
                        reducer(result, doc)
                        log.inc_processed()
                    }
                } catch(e) {
                    console.log(JSON.stringify(doc, null, '\t') + '\n' + e + '\n' + e.stack)
                    log.inc_processerror()
                }
            }
        }
        log.print_final()
        return result
    }

    map_current(
        mapper: (doc: Document) => void
    ): void {
        if (this.data.all.length > 1) {
            throw 'ERROR: Reorganization of current data is not allowed inside user transaction !'
            return
        }
        this.flush_sync(true, true, 'map_current_' + Date.now())
        this.tran_begin()
        for (let doc of this.data.all[0].current) {
            try {
                mapper(doc)
            } catch(e) {
                console.log(JSON.stringify(doc, null, '\t') + '\n' + e + '\n' + e.stack)
                return
            }
        }
        this.tran_commit()
    }

    get(id: string, allow_scan: boolean = true): Document | undefined {
        let cached: Document
        for (const tran of this.data.all) {
            cached = tran.cache_doc.get(id)
            if (cached !== undefined) {
                return cached
            }
        }
        if (allow_scan) {
            console.log('\nget("' + id + '") started...')
            const db = new DBReaderWithClass(this.dbpath + DBMeta.data_immut)
            for (let doc = db.next(); doc; doc = db.next()) {
                if (doc.id === id) {
                    this.data.cache_doc.set(id, doc)
                    return doc
                }
            }
            for (const tran of this.data.all) {
                for (const doc of tran.current) {
                    if (doc.id === id) {
                        this.data.cache_doc.set(id, doc)
                        return doc
                    }
                }
            }
        }
        return undefined
    }

    get_top(key: string, allow_scan: boolean = true): Document | undefined {
        let cached: Document
        for (let i = this.data.all.length - 1; i >= 0; i--) { // обрабатываем транзакции в обратном порядке
            const tran = this.data.all[i]
            cached = tran.cache_top.get(key)
            if (cached !== undefined) {
                return cached
            }
        }
        if (allow_scan) {
            console.log('\nget_top("' + key + '") started...')
            const db = new DBReaderWithClass(this.dbpath + DBMeta.data_immut)
            for (let doc = db.next(); doc; doc = db.next()) {
                if (doc.key === key) {
                    this.data.cache_top.set(key, doc)
                }
            }
            for (const tran of this.data.all) {
                for (const doc of tran.current) {
                    if (doc.key === key) {
                        this.data.cache_top.set(key, doc)
                    }
                }
            }
            return this.data.cache_top.get(key)
        }
        return undefined
    }

    add(doc: Document): [boolean, string?] {
        try {
            if (doc.id === undefined || doc.id === null || doc.id === '') {
                doc.id = doc.key + '^' + Date.now()
            }
            attach_doc_class(doc)
            this.tran_begin()
            this.data.current.push(doc)
            this.to_cache(doc)
            const [ok, msg] = doc.class.on_add(doc, this)
            if (ok) {
                this.tran_commit()
            } else {
                this.tran_rollback()
            }
            return [ok, msg]
        } catch(e) {
            console.log(JSON.stringify(doc, null, '\t') + '\n' + e + '\n' + e.stack)
            Deno.exit()
        }
    }

    private to_cache(doc: Document, log?: Log) { // порядок условий не трогать, тут все продумано !
        if (doc.class.cache_doc) {
            if (!this.data.cache_doc.has(doc.id)) {
                log?.inc_processed()
            }
            this.data.cache_doc.set(doc.id, doc)
        }
        if (doc.class.cache_top) {
            if (!this.data.cache_top.has(doc.key)) {
                log?.inc_processed1()
            }
            this.data.cache_top.set(doc.key, doc)
        }
    }

    doc_class(type: string): DocClass {
        return get_doc_class(type)
    }
    key_from_id(id: string): string {
        return id.slice(0, id.indexOf('^'))
    }

    tran_begin() {
        this.data.tran_begin()
    }
    tran_commit() {
        this.data.tran_commit()
    }
    tran_rollback() {
        this.data.tran_rollback()
    }

    flush_sync(and_cache: boolean = true, compact: boolean = true, snapshot: string = undefined) {
        console.log('\nflushing database to disk...')

        let path = this.dbpath
        if (snapshot !== undefined) {
            path += snapshot + '/'
            Deno.mkdirSync(path)
        }

        let cou = 0 
        let db = DBWriterSync.rewrite(path + DBMeta.data_current)
        for (const doc of this.data.current) {
            db.add(doc, compact)
            cou++
        }
        db.close()
        console.log('    data_current: ' + cou)

        if (and_cache) {
            cou = 0
            db = DBWriterSync.rewrite(path + DBMeta.cache_doc)
            for (const doc of this.data.cache_doc.values()) {
                db.add(doc, compact)
                cou++
            }
            db.close()
            console.log('    cache_doc: ' + cou)

            cou = 0
            db = DBWriterSync.rewrite(path + DBMeta.cache_top)
            for (const doc of this.data.cache_top.values()) {
                db.add(doc, compact)
                cou++
            }
            db.close()
            console.log('    cache_top: ' + cou)

            cou = 0
            db = DBWriterSync.rewrite(path + DBMeta.cache_reduce)
            for (const entr of this.data.cache_reduce.entries()) {
                db.add(entr, true)
                cou++
            }
            db.close()
            console.log('    cache_reduce: ' + cou)
        }
        console.log('database is flushed !')
    }

    async flush_async(and_cache: boolean = false, compact: boolean = true, snapshot: string = undefined) {
        console.log('\nflushing database to disk...')

        let path = this.dbpath
        if (snapshot !== undefined) {
            path += snapshot + '/'
            Deno.mkdirSync(path)
        }

        const ww = new Array<Promise<void>>()
        const dd = new Array<Promise<void>>()

        let cou = 0 
        let db = DBWriterAsync.rewrite(path + DBMeta.data_current)
        for (const doc of this.data.current) {
            ww.push(db.add(doc, compact))
            cou++
        }
        dd.push(db.close())
        console.log('    data_current: ' + cou)

        if (and_cache) {
            cou = 0
            db = DBWriterAsync.rewrite(path + DBMeta.cache_doc)
            for (const doc of this.data.cache_doc.values()) {
                ww.push(db.add(doc, compact))
                cou++
            }
            dd.push(db.close())
            console.log('    cache_doc: ' + cou)

            cou = 0
            db = DBWriterAsync.rewrite(path + DBMeta.cache_top)
            for (const doc of this.data.cache_top.values()) {
                ww.push(db.add(doc, compact))
                cou++
            }
            dd.push(db.close())
            console.log('    cache_top: ' + cou)

            cou = 0
            db = DBWriterAsync.rewrite(path + DBMeta.cache_reduce)
            for (const entr of this.data.cache_reduce.entries()) {
                ww.push(db.add(entr, true))
                cou++
            }
            dd.push(db.close())
            console.log('    cache_reduce: ' + cou)
        }

        await Promise.all(ww)
        await Promise.all(dd)

        console.log('database is flushed !')
    }
}

class DBReaderWithClass implements IDBReader {
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
            this.log?.inc_typeerror()
            return this.next()
        }
    }
}

function attach_doc_class(doc: Document) {
    doc.class = get_doc_class(doc.type)
}

class Log implements IDBLogger {
    readonly printcou = 10000
    readonly start = Date.now()
    readonly source: string
    readonly printmode: string
    total = 0
    parseerror = 0
    typeerror = 0
    processed = 0
    processed1 = 0
    processerror = 0
    cou = 0
    constructor(source, printmode) {
        this.source = source
        this.printmode = printmode
    }
    inc_total() { this.total++;  this.cou++ }
    inc_parseerror() { this.parseerror++ }
    inc_typeerror() { this.typeerror++ }
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
    ${this.total} total (\x1b[31m${this.parseerror}\x1b[0m JSON errors, \x1b[31m${this.typeerror}\x1b[0m type errors)
    ${this.processed} new docs placed in cache_doc
    ${this.processed1} new keys placed in cache_top
    ${elapsed}s elapsed`
                )
                return 6
            case 'file':
                console.log(
`    ====== scan ====== "${this.source}"
    ${this.total} total (\x1b[31m${this.parseerror}\x1b[0m JSON errors, \x1b[31m${this.typeerror}\x1b[0m type errors)
    ${this.processed} docs processed \x1b[31m(${this.processerror}\x1b[0m reduce errors)
    ${elapsed}s elapsed`
                )
                return 5
            case 'cache':
                console.log(
`    ====== scan ====== "${this.source}"
    ${this.total} total (\x1b[31m${this.parseerror}\x1b[0m JSON errors, \x1b[31m${this.typeerror}\x1b[0m type errors)
    ${elapsed}s elapsed`
                )
                return 4
            case 'cache_reduce':
                console.log(
`    ====== scan ====== "${this.source}"
    ${this.total} total (\x1b[31m${this.parseerror}\x1b[0m JSON errors)
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

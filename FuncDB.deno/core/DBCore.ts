import { Document, Accumulator, DBMeta, DocClass, IDBCore, IDBLog } from './DBMeta.ts'
import { IDBReader, DBReaderSync, DBWriterSync, DBWriterAsync } from './DBIO.ts'
import { get_doc_class } from '../doc_classes/.get_doc_class.ts'

export { Document, Accumulator }

class Transaction {
    current = new Array<Document>()
    cache_doc = new Map<string, Document>()
    cache_top = new Map<string, Document>()
}

class InMemoryData {
    readonly cache_doc_immut = new Map<string, Document>()
    readonly cache_top_immut = new Map<string, Document>()
    readonly cache_reduce = new Map<string, Accumulator>()
    readonly all = new Array<Transaction>()

    constructor() { this.all.push(new Transaction()) }

    get current(): Array<Document> { return this.all[this.all.length-1].current }
    get cache_doc(): Map<string, Document> { return this.all[this.all.length-1].cache_doc }
    get cache_top(): Map<string, Document> { return this.all[this.all.length-1].cache_top }

    tran_begin() { this.all.push(new Transaction()) }

    tran_commit() {
        if (this.all.length > 1) {
            const tran = this.all.pop()
            for (const val of tran.current) this.current.push(val)
            for (const [key, val] of tran.cache_doc.entries()) this.cache_doc.set(key, val)
            for (const [key, val] of tran.cache_top.entries()) this.cache_top.set(key, val)
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
    private data = new InMemoryData()

    constructor(dbpath) { 
        this.dbpath = dbpath
        console.log('\ndatabase initialization started...')
        this.init_immut()
        this.init_mut()
        console.log('database is initialized !')
    }

    private init_immut(from_cache: boolean = true) {
        if (from_cache) {
            try {
                Deno.openSync(this.dbpath + DBMeta.cache_doc, 'r').close()
                Deno.openSync(this.dbpath + DBMeta.cache_top, 'r').close()
                Deno.openSync(this.dbpath + DBMeta.cache_reduce, 'r').close()
            } catch(_) {
                from_cache = false
            }
        }
        if (from_cache) {
            let db = new DocReader(this.dbpath + DBMeta.cache_doc, 'cache')
            for (let doc = db.next(); doc; doc = db.next()) this.data.cache_doc_immut.set(doc.id, doc)
            db.log.print_final()

            db = new DocReader(this.dbpath + DBMeta.cache_top, 'cache')
            for (let doc = db.next(); doc; doc = db.next()) this.data.cache_top_immut.set(doc.key, doc)
            db.log.print_final()

            const log = new Log(this.dbpath + DBMeta.cache_reduce, 'cache_reduce')
            const db1 = new DBReaderSync(this.dbpath + DBMeta.cache_reduce, log)
            for (let red = db1.next(); red; red = db1.next()) this.data.cache_reduce.set(red[0], red[1])
            log.print_final()
        } else {
            const db = new DocReader(this.dbpath + DBMeta.data_immut, 'init')
            for (let doc = db.next(); doc; doc = db.next()) {
                this.to_cache_immut(doc, db.log)
            }
            db.log.print_final()
        }
        this.data.all[0].cache_doc = new Map(this.data.cache_doc_immut)
        this.data.all[0].cache_top = new Map(this.data.cache_top_immut)
    }

    private init_mut(no_cache: boolean = false) {
        const db = new DocReader(this.dbpath + DBMeta.data_current, 'init')
        for (let doc = db.next(); doc; doc = db.next()) {
            this.data.current.push(doc)
            this.to_cache(doc, db.log)
        }
        db.log.print_final()
    }

    private to_cache_immut(doc: Document, log?: IDBLog) {
        if (doc.class.cache_doc) {
            if (log !== undefined && !this.data.cache_doc_immut.has(doc.id)) log.inc_processed()
            this.data.cache_doc_immut.set(doc.id, doc)
        }
        if (doc.class.cache_top) {
            if (log !== undefined && !this.data.cache_top_immut.has(doc.key)) log.inc_processed1()
            this.data.cache_top_immut.set(doc.key, doc)
        }
    }

    private to_cache(doc: Document, log?: IDBLog) {
        if (doc.class.cache_doc) {
            if (log !== undefined && !this.data.cache_doc.has(doc.id)) log.inc_processed()
            this.data.cache_doc.set(doc.id, doc)
        }
        if (doc.class.cache_top) {
            if (log !== undefined && !this.data.cache_top.has(doc.key)) log.inc_processed1()
            this.data.cache_top.set(doc.key, doc)
        }
    }

    reduce(
        filter: (accum: Accumulator, doc: Document) => boolean, 
        reducer: (accum: Accumulator, doc: Document) => void,
        accum: Accumulator,
        to_cache: boolean = true,
    ): Accumulator {
        const key = filter.toString() + ',\n' + reducer.toString() + ',\n' + JSON.stringify(accum)
        console.log('\nreduce() started...')
        //console.log('\nreduce() started...\n' + key)
        const cached = this.data.cache_reduce.get(key)
        if (cached !== undefined) {
            console.log('    immutable part of result taken from cache !')
            accum = JSON.parse(cached)
        } else {
            const db = new DocReader(this.dbpath + DBMeta.data_immut, 'file')
            for (let doc = db.next(); doc; doc = db.next()) {
                reduce1(doc, db.log)
            }
            db.log.print_final()
            if (to_cache) {
                this.data.cache_reduce.set(key, JSON.stringify(accum))
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
        return accum

        function reduce1(doc: Document, log?: Log) {
            try {
                if(filter(accum, doc)) {
                    reducer(accum, doc)
                    log?.inc_processed()
                }
            } catch(e) {
                console.log(JSON.stringify(doc, null, '\t') + '\n' + e + '\n' + e.stack)
                log?.inc_processerror()
            }
        }
    }

    reduce_top(
        filter: (accum: Accumulator, doc: Document) => boolean, 
        reducer: (accum: Accumulator, doc: Document) => void,
        accum: Accumulator,
    ): Accumulator {
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
                    if(filter(accum, doc)) {
                        reducer(accum, doc)
                        log.inc_processed()
                    }
                } catch(e) {
                    console.log(JSON.stringify(doc, null, '\t') + '\n' + e + '\n' + e.stack)
                    log.inc_processerror()
                }
            }
        }
        log.print_final()
        return accum
    }

    recreate_current(
        creator: (accum: Accumulator, doc: Document) => void,
        accum: Accumulator
    ): void {
        if (this.data.all.length > 1) {
            throw 'ERROR: Recreation of current data is not allowed inside user transaction !'
            return
        }
        this.flush_sync(false, true, 'overwrite_current_' + Date.now())

        console.log('\noverwrite_current() started...')
        const log = new Log('in-memory/current', 'memory')

        this.tran_begin()
        this.data.all[1].cache_doc = new Map(this.data.cache_doc_immut)
        this.data.all[1].cache_top = new Map(this.data.cache_top_immut)
        for (let doc of this.data.all[0].current) {
            log.inc_total()
            try {
                creator(accum, doc)
            } catch(e) {
                console.log(JSON.stringify(doc, null, '\t') + '\n' + e + '\n' + e.stack)
                this.tran_rollback()
                return
            }
        }
        this.data.all[0].current = this.data.current
        this.data.all[0].cache_doc = this.data.cache_doc
        this.data.all[0].cache_top = this.data.cache_top
        this.tran_rollback()

        log.print_final()
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
            const db = new DocReader(this.dbpath + DBMeta.data_immut)
            for (let doc = db.next(); doc; doc = db.next()) {
                if (doc.id === id) {
                    this.data.cache_doc_immut.set(id, doc)
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
            const db = new DocReader(this.dbpath + DBMeta.data_immut)
            for (let doc = db.next(); doc; doc = db.next()) {
                if (doc.key === key) {
                    this.data.cache_top_immut.set(key, doc)
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
                doc.id = this.id_from_key(doc.key)
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

    key_from_id(id: string): string {
        return key_from_id(id)
    }
    id_from_key(key: string): string {
        return key + '^' + Date.now()
    }
    doc_class(type: string): DocClass {
        return get_doc_class(type)
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
            delete doc.key
            delete doc.ts
            db.add(doc, compact)
            cou++
        }
        db.close()
        console.log('    data_current: ' + cou)

        if (and_cache) {
            cou = 0
            db = DBWriterSync.rewrite(path + DBMeta.cache_doc)
            for (const doc of this.data.cache_doc_immut.values()) {
                delete doc.key
                delete doc.ts
                db.add(doc, compact)
                cou++
            }
            db.close()
            console.log('    cache_doc: ' + cou)

            cou = 0
            db = DBWriterSync.rewrite(path + DBMeta.cache_top)
            for (const doc of this.data.cache_top_immut.values()) {
                delete doc.key
                delete doc.ts
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

    // не работает, почему - не разобрался, да и массив промисов создает не быстрее, чем синхрон на диск пишет
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
            for (const doc of this.data.cache_doc_immut.values()) {
                ww.push(db.add(doc, compact))
                cou++
            }
            dd.push(db.close())
            console.log('    cache_doc: ' + cou)

            cou = 0
            db = DBWriterAsync.rewrite(path + DBMeta.cache_top)
            for (const doc of this.data.cache_top_immut.values()) {
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

class DocReader implements IDBReader {
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
            if (doc.key !== undefined || doc.ts !== undefined) throw '"key" or "ts" member is allready exist in JSON !'
            doc.key = key_from_id(doc.id)
            doc.ts = ts_from_id(doc.id)
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


function key_from_id(id: string): string {
    return id.slice(0, -14)
}

function ts_from_id(id: string): string {
    return id.slice(-13)
}

function attach_doc_class(doc: Document) {
    doc.class = get_doc_class(doc.type)
}

class Log implements IDBLog {
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

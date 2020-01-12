import { BufReader } from 'https://deno.land/std/io/bufio.ts'

const enum DBFile {
    Immutable = 'database_immutable.json',
    Current = 'database_current.json'
}

type Document = any
type Result = any

export class FuncDB {
    private dbpath: string
    private full_cache: Map<string, Document>
    private top_cache: Map<string, Document>
    private log: Log

    private constructor(dbpath: string) {
        this.dbpath = dbpath
        this.full_cache = new Map()
        this.top_cache = new Map()
    }

    public static open(dbpath: string): FuncDB {
        return new FuncDB(dbpath)
    }

    public async reduce(
        filter: (result: Result, doc: Document) => Promise<boolean>, 
        reducer: (result: Result, doc: Document) => Promise<void>,
        result: Result
    ): Promise<Result> {
        const key = filter.toString() + reducer.toString() + JSON.stringify(result)
        const cached = this.full_cache.get(key)
        if (cached !== undefined) {
            result = JSON.parse(cached)
        } else {
            await this.reduce1(DBFile.Immutable, filter, reducer, result)
            this.full_cache.set(key, JSON.stringify(result))
        }
        await this.reduce1(DBFile.Current, filter, reducer, result)
        return result
    }

    private async reduce1(
        fname: string,
        filter: (result: Result, doc: Document) => Promise<boolean>, 
        reducer: (result: Result, doc: Document) => Promise<void>,
        result: Result
    ): Promise<Result> {
        const db = new BufReader(Deno.openSync(this.dbpath + fname))
        this.log = new Log(fname)
        while(true) {
            const chunk = await db.readString('\x01')
            if (chunk == Deno.EOF) {
                this.log.write()
                break
            }
            this.log.discovered++
            try {
                const doc = JSON.parse(chunk.slice(0,-1))
                this.log.parsed++
                try {
                    if (doc.sys.cache == 1) {
                        this.full_cache.set(doc.sys.id, doc)
                        this.top_cache.set(doc.sys.code, doc)
                    }
                    if(await filter(result, doc)) {
                        await reducer(result, doc)
                        this.log.processed++
                    }
                } catch(e) {
                    console.log(doc + '\n' + e)
                    this.log.processerror++
                }
            } catch(e) {
                console.log(chunk + '\n' + e)
                this.log.parseerror++
            }
        }
        return result
    }

    public async get(id: string): Promise<Document | undefined> {
        let cached = this.full_cache.get(id)
        if (cached !== undefined) {
            return cached
        } else {
            const doc = await this.get1(DBFile.Immutable, id)
            if (doc !== undefined) {
                this.full_cache.set(id, doc)
                return doc
            } else {
                return await this.get1(DBFile.Current, id)
            }
        }
    }

    private async get1(fname: string, id: string): Promise<Document | undefined> {
        const db = new BufReader(Deno.openSync(this.dbpath + fname))
        while(true) {
            const chunk = await db.readString('\x01')
            if (chunk == Deno.EOF) {
                return undefined
            }
            try {
                const doc =  JSON.parse(chunk.slice(0,-1))
                try {
                    if (doc.sys.id === id) {
                        return doc
                    }
                } catch(_) {}
            } catch(_) {}
        }
    }

    public async gettop(code: string): Promise<Document | undefined> {
        let cached = this.top_cache.get(code)
        if (cached !== undefined) {
            return cached
        } else {
            await this.gettop1(DBFile.Immutable, code)
            await this.gettop1(DBFile.Current, code)
            return this.top_cache.get(code)
        }
    }

    private async gettop1(fname: string, code: string): Promise<void> {
        const db = new BufReader(Deno.openSync(this.dbpath + fname))
        while(true) {
            const chunk = await db.readString('\x01')
            if (chunk == Deno.EOF) {
                return
            }
            try {
                const doc =  JSON.parse(chunk.slice(0,-1))
                try {
                    if (doc.sys.code === code) {
                        this.top_cache.set(code, doc)
                    }
                } catch(_) {}
            } catch(_) {}
        }
    }

    public add(doc: Document) {
        const sys = doc.sys
        sys.ts = Date.now()
        sys.id = sys.code + '^' + sys.ts
        const f = Deno.openSync(this.dbpath + DBFile.Current, 'a')
        f.writeSync(new TextEncoder().encode(JSON.stringify(doc) + '\x01'))
        f.close()
        this.top_cache.set(sys.code, doc)
    }
}

class Log {
    fname = ''
    discovered = 0
    parsed = 0
    parseerror = 0
    processed = 0
    processerror = 0
    elapsed = Date.now()
    constructor(fname) {
        this.fname = fname
    }
    write() {
        this.elapsed = (Date.now() - this.elapsed) / 1000
        console.log(`
            file: ${this.fname}:
            ${this.discovered} docs discovered
            ${this.parsed} docs parsed \x1b[31m(${this.parseerror} errors)\x1b[0m
            ${this.processed} docs processed \x1b[31m(${this.processerror} errors)\x1b[0m
            ${this.elapsed}s elapsed`
        )
    }
}

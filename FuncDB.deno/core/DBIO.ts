import { BufReader, BufWriter } from 'https://deno.land/std/io/bufio.ts'
import { Document, DBMeta, IDBLog } from './DBMeta.ts'

const read_buf_size = 40960
const chunk_buf_size = 409600 // надо сделать авторесайз чанка, иначе Accumulator может когда-нибудь не влезть
const write_buf_size = 4096 
// при записи через File.write() невозможно указать буфер отличный от стандартного, 
// а бOльшие буфера просто молча обрезаются и не записываются в файл (проверется на 3-м примере)
// дефект Deno

export interface IDBReader {
    next(): Document | false | Promise<Document | false> 
    readonly log?: IDBLog
}  

export class DBReaderSync implements IDBReader {
    private file: Deno.File
    readonly log?: IDBLog
    private delim: number = DBMeta.delim
    private decoder = new TextDecoder()

    private buf = new Uint8Array(read_buf_size)
    private p1 = 0
    private p2 = -1
    private buf3 = new Uint8Array(chunk_buf_size)
    private p3 = 0

    constructor(fpath: string, log?: IDBLog) {
        this.file = Deno.openSync(fpath, 'r')
        this.log = log
    }

    next(): Document | false {
        let res_a: Uint8Array
        while (this.p2 > -1 || this.read_buf()) {
            this.p2 = this.buf.indexOf(this.delim, this.p1)
            if (this.p2 > -1) {
                if (this.p3 === 0) {
                    res_a = this.buf.subarray(this.p1, this.p2)
                    this.p1 =  this.p2 + 1
                    break
                } else {
                    const b = this.buf.slice(this.p1, this.p2)
                    this.buf3.set(b, this.p3)
                    this.p3 += b.length
                    res_a = this.buf3.subarray(0, this.p3)
                    this.p1 =  this.p2 + 1
                    this.p3 = 0
                    break
                }
            } else {
                const b = this.buf.slice(this.p1)
                this.buf3.set(b, this.p3)
                this.p3 += b.length
            }
        }
        switch (res_a) {
            case undefined:
                this.file.close()
                return false
            default:
                const res_s = this.decoder.decode(res_a)
                this.log?.inc_total()
                try {
                    const res_o = JSON.parse(res_s)
                    return res_o
                } catch(e) {
                    console.log(res_s + '\n' + e + '\n' + e.stack)
                    this.log?.inc_parseerror()
                    return this.next()
                }
        }
    }

    private read_buf(): boolean {
        this.p1 = 0
        const cou = this.file.readSync(this.buf)
        switch (cou) {
            case read_buf_size:
                return true
            case Deno.EOF:
                return false
            default:
                this.buf = this.buf.slice(0, cou)
                return true
        }
    }
}

export class DBReaderAsync implements IDBReader {
    private file: Deno.File
    readonly log?: IDBLog
    private reader: BufReader
    private delim: string = String.fromCharCode(DBMeta.delim)

    constructor(fpath: string, log?: IDBLog) {
        this.file = Deno.openSync(fpath, 'r')
        this.log = log
        this.reader = new BufReader(this.file, read_buf_size)
    }

    async next(): Promise<Document | false> {
        let res_s = await this.reader.readString(this.delim)
        switch (res_s) {
            case Deno.EOF:
                this.file.close()
                return false
            default: 
                res_s = res_s.slice(0,-1)
                this.log?.inc_total()
                try {
                    const res_o = JSON.parse(res_s)
                    return res_o
                } catch(e) {
                    console.log(res_s + '\n' + e + '\n' + e.stack)
                    this.log?.inc_parseerror()
                    return await this.next()
                }
        }
    } 
}

export class DBWriterSync {
    private file: Deno.File
    private delim: string = String.fromCharCode(DBMeta.delim)
    private encoder = new TextEncoder()

    private constructor(fpath: string, fmode: 'a' | 'w') {
        this.file = Deno.openSync(fpath, fmode)
    }

    static append(fpath: string) { return new DBWriterSync(fpath, 'a') }
    static rewrite(fpath: string) { return new DBWriterSync(fpath, 'w') }

    add(doc: Document, compact: boolean = true) {
        const doc_s = compact ? JSON.stringify(doc) : JSON.stringify(doc, null, '\t')
        const arr = this.encoder.encode('\n' + doc_s + this.delim)
        let i = 0
        while (i < arr.length) {
            let buf: Uint8Array
            if (arr.length <= i + write_buf_size) {
                buf = arr.subarray(i)
            } else {
                buf = arr.subarray(i, i + write_buf_size)
            }
            this.file.writeSync(buf)
            i += write_buf_size
        }
    }

    close() {
        this.file.close()
    }
}

export class DBWriterAsync {
    private file: Deno.File
    private writer: BufWriter
    private delim: string = String.fromCharCode(DBMeta.delim)
    private encoder = new TextEncoder()

    private constructor(fpath: string, fmode: 'a' | 'w') {
        this.file = Deno.openSync(fpath, fmode)
        this.writer = new BufWriter(this.file, write_buf_size)
    }

    static append(fpath: string) { return new DBWriterAsync(fpath, 'a') }
    static rewrite(fpath: string) { return new DBWriterAsync(fpath, 'w') }

    async add(doc: Document, compact: boolean = true) {
        const doc_s = compact ? JSON.stringify(doc) : JSON.stringify(doc, null, '\t')
        await this.writer.write(this.encoder.encode('\n' + doc_s + this.delim))
    }

    async close() {
        await this.writer.flush()
        this.file.close()
    }
}

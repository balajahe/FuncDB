import { BufReader } from 'https://deno.land/std/io/bufio.ts'
import { Document, DBMeta, IDBLogger } from './DBMeta.ts'

const read_buf_size = 40960
const chunk_buf_size = 409600 // надо сделать авторесайз чанка, иначе Result может когда-нибудь не влезть
const write_buf_size = 4096 
// при записи через File.write() невозможно указать буфер отличный от стандартного, 
// а бOльшие буфера просто молча обрезаются и не записываются в файл (дефект Deno)

export interface IDBReader {
    next(): Document | false | Promise<Document | false> 
    readonly log?: IDBLogger
}   

export class DBReaderSync implements IDBReader {
    private file: Deno.File
    readonly log?: IDBLogger
    private delim: number = DBMeta.delim
    private buf = new Uint8Array(read_buf_size)
    private p1 = 0
    private p2 = -1
    private buf3 = new Uint8Array(chunk_buf_size)
    private p3 = 0
    private decoder = new TextDecoder()

    constructor(fpath: string, log?: IDBLogger) {
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
    readonly log?: IDBLogger
    private delim: string = String.fromCharCode(DBMeta.delim)
    private reader: BufReader

    constructor(fpath: string, log?: IDBLogger) {
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

    private constructor(fpath: string, fmode: 'a' | 'w') {
        this.file = Deno.openSync(fpath, fmode)
    }

    static append(fpath: string) { return new DBWriterSync(fpath, 'a') }
    static rewrite(fpath: string) { return new DBWriterSync(fpath, 'w') }

    add(doc: Document, compact: boolean = true) {
        let doc_s: string
        if (compact) {
            doc_s = JSON.stringify(doc)
        } else {
            doc_s = JSON.stringify(doc, null, '\t')
        }
        // синхронного буфер-райтера похоже нет в Deno, приходится извращаться
        const arr = new TextEncoder().encode('\n' + doc_s + this.delim)
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

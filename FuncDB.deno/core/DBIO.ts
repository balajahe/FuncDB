import { BufReader, BufWriter } from 'https://deno.land/std/io/bufio.ts'
import { Document, DBMeta, IDBLogger } from './DBMeta.ts'

const read_buf_size = 40960
const chunk_buf_size = 40960
const write_buf_size = 40960

export interface IDBReader {
    next?(): Document | false
    next?(): Promise<Document | false> 
}   

export class DBReaderSync implements IDBReader {
    private file: Deno.File
    private logger?: IDBLogger
    private delim: number = DBMeta.delim
    private buf = new Uint8Array(read_buf_size)
    private p1 = 0
    private p2 = -1
    private buf3 = new Uint8Array(chunk_buf_size)
    private p3 = 0
    private decoder = new TextDecoder()

    constructor(fpath: string, logger?: IDBLogger) {
        this.file = Deno.openSync(fpath, 'r')
        this.logger = logger
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
                this.logger?.inc_total()
                try {
                    const res_o = JSON.parse(res_s)
                    this.logger?.inc_parsed()
                    return res_o
                } catch(e) {
                    console.log(res_s + '\n' + e.stack)
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
    private logger?: IDBLogger
    private delim: string = String.fromCharCode(DBMeta.delim)
    private reader: BufReader

    constructor(fpath: string, logger?: IDBLogger) {
        this.file = Deno.openSync(fpath, 'r')
        this.logger = logger
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
                this.logger?.inc_total()
                try {
                    const res_o = JSON.parse(res_s)
                    this.logger?.inc_parsed()
                    return res_o
                } catch(e) {
                    console.log(res_s + '\n' + e.stack)
                    return await this.next()
                }
        }
    } 
}

export class DBWriter {
    private file: Deno.File
    private delim: string = String.fromCharCode(DBMeta.delim)

    private constructor(fpath: string, fmode: 'a' | 'w') {
        this.file = Deno.openSync(fpath, fmode)
    }

    static append(fpath: string) { return new DBWriter(fpath, 'a') }
    static rewrite(fpath: string) { return new DBWriter(fpath, 'w') }

    add(doc: Document): void {
        const doc_s = JSON.stringify(doc, null, '\t')
//        const doc_s = JSON.stringify(doc)
        this.file.writeSync(new TextEncoder().encode('\n' + doc_s + this.delim))
    }

    close(): void {
        this.file.close()
    }
}

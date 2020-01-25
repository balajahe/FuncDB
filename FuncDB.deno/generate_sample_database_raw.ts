import { BufWriter } from 'https://deno.land/std/io/bufio.ts'
import { DBMeta } from './core/DBMeta.ts'

const dbpath = './sample_database/'

let personcou = 5000
let nomencou = 3000
let stockcou = 50
let doccou = 100000
let maxlinecou = 50
const mut_scale = 1/10

let compact: boolean
let db: BufWriter
let ts: number

try {
    Deno.removeSync(dbpath, {recursive: true})
} catch(_) {}
Deno.mkdirSync(dbpath)

compact = true
await gen_file(DBMeta.data_immut)
console.log('immutable docs = ' + (personcou + nomencou + stockcou + doccou*3))

compact = false
personcou = Math.floor(personcou * mut_scale)
nomencou = Math.floor(nomencou * mut_scale)
stockcou = Math.floor(stockcou * mut_scale)
doccou = Math.floor(doccou * mut_scale)
await gen_file(DBMeta.data_mut_current)
console.log('mutable docs = ' + (personcou + nomencou + stockcou + doccou*3))


async function gen_file(fname: string) {
    const dbf = Deno.openSync(dbpath + fname, 'w')
    db = new BufWriter(dbf)
    ts = Date.now()
    
    await gen_persons()
    await gen_nomens()
    await gen_stocks()
    await gen_docs()
    
    await db.flush()
    dbf.close()
}

// persons (partners)
async function gen_persons() {
    const person_types = ['retail', 'wholesale']
    for (let i = 0; i < personcou; i++) {
        let doc = 
            {
                type: 'ref',
                key: 'person.' + i,
                id: 'person.' + i + '^' + ts,
                erp_type: 'person.' + arand(person_types),
                name: 'person ' + i 
            }
        await write(doc)
    }
}

// stock nomenclature
async function gen_nomens() {
    const nomen_types = ['tool', 'material', 'asset']
    for (let i = 0; i < nomencou; i++) {
        let doc = 
            {
                type: 'ref',
                key: 'nomen.' + i,
                id: 'nomen.' + i + '^' + ts,
                erp_type: 'nomen.' + arand(nomen_types),
                name: 'nomen ' + i 
            }
        await write(doc)
    }
}

// stocks (warehouses) including goods in transit
async function gen_stocks() {
    const stock_types = ['storage', 'transfer']
    for (let i = 0; i < stockcou; i++) {
        let doc =
            {
                type: 'ref',
                key: 'stock.' + i,
                id: 'stock.' + i + '^' + ts,
                erp_type: 'stock.' + arand(stock_types),
                name: 'stock ' + i 
            }
        await write(doc)
    } 
}

// all documents: purch, transfer, sale
async function gen_docs() {
    const date = new Date().toISOString().substr(0,10)
    const doc_types = ['purch', 'transfer', 'sale']
    for (let doctype of doc_types) {
        let i = 0
        while (i < doccou) {
            let doc: any =
                {
                    type: doctype,
                    key: doctype + '.' + i,
                    id: doctype + '.' + i + '^' + ts,
                    date: date,
                    person: 'person.' + irand(0, personcou-1) + '^' + ts
                }
            if (doctype !== 'transfer') {
                doc.stock = 'stock.' + irand(0, stockcou-1) + '^' + ts
            } else {
                doc.stock1 = 'stock.' + irand(0, stockcou-1) + '^' + ts
                doc.stock2 = 'stock.' + irand(0, stockcou-1) + '^' + ts
            }
            doc.lines = []
            for (let j = 0; j < irand(1, maxlinecou); j++) {
                const line: any = 
                    {
                        nomen: 'nomen.' + irand(0, nomencou-1) + '^' + ts,
                        qty: doctype === 'purch' ? irand(1, 30*10) : irand(1, 30)
                    }
                if (doctype !== 'transfer') {
                    line.price = frand(100, 300)
                }
                doc.lines.push(line)
            }
            await write(doc)
            i++
        }
    }
} 

async function write(doc: any) {
    let doc_s = compact ? JSON.stringify(doc) : JSON.stringify(doc, null, '\t')
    await db.write(new TextEncoder().encode('\n' + doc_s + String.fromCharCode(DBMeta.delim)))
}

function frand(min: number, max: number): number {
    const rand = min + Math.random() * (max - min)
    return rand
}

function irand(min: number, max: number): number {
    const rand = min + Math.random() * (max + 1 - min)
    return Math.floor(rand)
}
  
function arand(arr: any[]): any {
    const rand = Math.random() * arr.length
    return arr[Math.floor(rand)]
}

import { BufWriter } from 'https://deno.land/std/io/bufio.ts'
import { DBMeta } from './core/DBMeta.ts'

const dbpath = './sample_database/'
let compact = false

const mut_scale = 1
const immut_scale = 24.4

let personcou = 30
let nomencou = 40
let stockcou = 30
let doccou = 1000
let maxlinecou = 100

let db: BufWriter
let ts: number

try {
    Deno.removeSync(dbpath, {recursive: true})
} catch(_) {}
Deno.mkdirSync(dbpath)

personcou *= mut_scale
nomencou  *= mut_scale
stockcou *= mut_scale
doccou *= mut_scale
await gen_file(DBMeta.data_mut_current)

personcou *= immut_scale
nomencou  *= immut_scale
stockcou *= immut_scale
doccou *= immut_scale
compact = true
await gen_file(DBMeta.data_immut)


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
        let doc = `
            {
                "sys": {
                    "class": "ref",
                    "code": "person.${i}",
                    "ts": ${ts},
                    "id": "person.${i}^${ts}"
                },
                "type": "person.${arand(person_types)}",
                "name": "person ${i}" 
            }`
        await write(doc)
    }
}

// stock nomenclature
async function gen_nomens() {
    const nomen_types = ['tool', 'material', 'asset']
    for (let i = 0; i < nomencou; i++) {
        let doc = `
            {
                "sys": {
                    "class": "ref",
                    "code": "nomen.${i}",
                    "ts": ${ts},
                    "id": "nomen.${i}^${ts}"
                },
                "type": "nomen.${arand(nomen_types)}",
                "name": "nomen ${i}"
            }`
        await write(doc)
    }
}

// stocks (warehouses) including goods in transit
async function gen_stocks() {
    const stock_types = ['storage', 'transfer']
    for (let i = 0; i < stockcou; i++) {
        let doc = `
            {
                "sys": {
                    "class": "ref",
                    "code": "stock.${i}",
                    "ts": ${ts},
                    "id": "stock.${i}^${ts}" 
                },
                "type": "stock.${arand(stock_types)}",
                "name": "stock ${i}"
            }`
        await write(doc)
    } 
}

// all documents: purch, transfer, sale
async function gen_docs() {
    const date = new Date().toISOString().substr(0,10)
    const doc_types = ['purch', 'transfer.out', 'transfer.in', 'sale']
    for (let doctype of doc_types) {
        for (let i = 0; i < doccou; i++) {
            const person = 'person.' + irand(0, personcou-1) + '^' + ts
            const stock1 = 'stock.' + irand(0, stockcou-1) + '^' + ts
            const stock2 = 'stock.' + irand(0, stockcou-1) + '^' + ts
            let docclass = ''
            let stocks = ''
            if (!doctype.startsWith('transfer')) {
                docclass = doctype
                stocks = `
                    "stock": "${stock1}"`
            } else {
                docclass = 'transfer'
                stocks = `
                    "stock1": "${stock1}",
                    "stock2": "${stock2}"`
            }
            let lines = '['
            for (let j = 0; j < irand(1, maxlinecou); j++) {
                const nomen = 'nomen.' + irand(0, nomencou-1) + '^' + ts
                if (j > 0) lines += ','
                lines += `
                        {
                            "nomen": "${nomen}",
                            "qty": ${irand(1, 30)},
                            "price": ${frand(100, 300)}
                        }`
            }
            lines += `
                    ]`
            let doc = `
                {
                    "sys": {
                        "class": "${docclass}",
                        "code": "${doctype}.${i}",
                        "ts": ${ts},
                        "id": "${doctype}.${i}^${ts}"  
                    },
                    "type": "${doctype}",
                    "date": "${date}",
                    "person": "${person}",${stocks},
                    "lines": ${lines}
                }`
            await write(doc)
        }
    }
} 

async function write(doc: string) {
    if (compact) doc = JSON.stringify(JSON.parse(doc))
    await db.write(new TextEncoder().encode('\n' + doc + String.fromCharCode(DBMeta.delim)))
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

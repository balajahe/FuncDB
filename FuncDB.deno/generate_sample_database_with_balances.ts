import { DBCore } from './core/DBCore.ts'
import { DBMeta } from './core/DBMeta.ts'

const dbpath = './sample_database/'

let personcou = 5000
let nomencou = 3000
let stockcou = 50
let doccou = 100000
let maxlinecou = 50
const mut_scale = 1/10

let db: DBCore
let ts: number

try {
    Deno.removeSync(dbpath, {recursive: true})
} catch(_) {}
Deno.mkdirSync(dbpath)
Deno.openSync(dbpath + DBMeta.data_immut, 'w').close()
Deno.openSync(dbpath + DBMeta.data_mut_current, 'w').close()

db = DBCore.open(dbpath)
gen_file()
db.flush(true) // кэш не записываем, так как мы подменяем файл
Deno.renameSync(dbpath + DBMeta.data_mut_current, dbpath + DBMeta.data_immut)
Deno.openSync(dbpath + DBMeta.data_mut_current, 'w').close()

personcou = Math.floor(personcou * mut_scale)
nomencou = Math.floor(nomencou * mut_scale)
stockcou = Math.floor(stockcou * mut_scale)
doccou = Math.floor(doccou * mut_scale)
db = DBCore.open(dbpath)
gen_file()
db.flush() // база готова вместе с кэшем

function gen_file() {
    ts = Date.now()
    gen_persons()
    gen_nomens()
    gen_stocks()
    gen_docs()
}

// persons (partners)
function gen_persons() {
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
        db.add_mut(doc)
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
        db.add_mut(doc)
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
        db.add_mut(doc)
    } 
}

// all documents: purch, transfer, sale
async function gen_docs() {
    const date = new Date().toISOString().substr(0,10)
    const doc_types = ['purch', 'transfer', 'sale']
    let couall = 0
    let cou = 0
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
            const [ok, msg] = db.add_mut(doc)
            if (ok) {
                i++
                couall++
                cou++
                if (cou === 1000) {
                    console.log('\ngenerating ' + doctype + ' docs in-memory: ' + i + '            \x1b[2A')
                    cou = 0
                }
            }
        }
    }
    console.log('\ngenerated total docs in-memory: ' + couall + '            ')
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

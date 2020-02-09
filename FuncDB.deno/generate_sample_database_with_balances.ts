import { ERPCore } from './core/ERPCore.ts'
import { DBMeta } from './core/DBMeta.ts'

const dbpath = './database/'

let personcou = 5000
let nomencou = 3000
let stockcou = 50
let prodcou = 3000
let doccou = 10000
let maxlinecou = 50
const mut_scale = 1/10

let db: ERPCore
let ts: number

try {
    Deno.removeSync(dbpath, {recursive: true})
} catch(_) {}
Deno.mkdirSync(dbpath)
Deno.mkdirSync(dbpath + DBMeta.snapshots)
Deno.openSync(dbpath + DBMeta.data_immut, 'w').close()
Deno.openSync(dbpath + DBMeta.data_current, 'w').close()

// генерируем иммутабельные данные
db = new ERPCore(dbpath)
gen_file(['purch.post', 'transfer.post', 'sale.post'])
db.flush_sync(false) // кэш не записываем, так как нам нужен только один датафайл
Deno.renameSync(dbpath + DBMeta.data_current, dbpath + DBMeta.data_immut)
Deno.openSync(dbpath + DBMeta.data_current, 'w').close()

// генерируем мутабельные данные
personcou = Math.floor(personcou * mut_scale)
nomencou = Math.floor(nomencou * mut_scale)
stockcou = Math.floor(stockcou * mut_scale)
prodcou = Math.floor(prodcou * mut_scale)
doccou = Math.floor(doccou * mut_scale)
db = new ERPCore(dbpath)
gen_file(['purch.post', 'transfer.post', 'sale.post', 'prod.in.post', 'prod.out.post'])

// генерируем открытые (неразнесенные) документы
gen_docs(['purch.open', 'sale.open'])
db.flush_sync() // база готова вместе с кэшем


function gen_file(doc_types: string[]) {
    ts = Date.now()
    gen_persons()
    gen_nomens()
    gen_stocks()
    gen_prods()
    gen_docs(doc_types)
}

// persons (partners)
function gen_persons() {
    const person_types = ['retail', 'wholesale']
    for (let i = 0; i < personcou; i++) {
        let doc = 
            {
                type: 'person',
                id: 'person.' + i + '^' + ts,
                erp_type: 'person.' + arand(person_types),
                name: 'person ' + i 
            }
        db.add(doc)
    }
}

// stock nomenclature
async function gen_nomens() {
    const nomen_types = ['tool', 'material', 'asset']
    for (let i = 0; i < nomencou; i++) {
        let doc = 
            {
                type: 'nomen',
                id: 'nomen.' + i + '^' + ts,
                erp_type: 'nomen.' + arand(nomen_types),
                name: 'nomen ' + i 
            }
        db.add(doc)
    }
}

// stocks (warehouses) including goods in transit
async function gen_stocks() {
    const stock_types = ['storage', 'transfer']
    for (let i = 0; i < stockcou; i++) {
        let doc =
            {
                type: 'stock',
                id: 'stock.' + i + '^' + ts,
                erp_type: 'stock.' + arand(stock_types),
                name: 'stock ' + i 
            }
        db.add(doc)
    } 
}

// production orders
async function gen_prods() {
    for (let i = 0; i < prodcou; i++) {
        let doc: any =
            {
                type: 'prod',
                id: 'prod.' + i + '^' + ts,
                name: 'stock ' + i 
            }
        doc.lines = []
        for (let j = 0; j < irand(1, maxlinecou); j++) {
            doc.lines.push(
                {
                    nomen: 'nomen.' + irand(0, nomencou-1) + '^' + ts,
                    qty: irand(1, 30),
                    cost_norm: frand(100, 300)
                }
            )
        }
        db.add(doc)
    } 
}

// all posted documents: purch, transfer, sale
async function gen_docs(doc_types: string[]) {
    const date = new Date().toISOString().substr(0,10)
    let couall = 0
    let cou = 0
    for (let doctype of doc_types) {
        let i = 0
        while (i < doccou) {
            let doc: any =
                {
                    type: doctype,
                    id: doctype + '.' + i + '^' + ts,
                    date: date,
                    person: 'person.' + irand(0, personcou-1) + '^' + ts
                }

            if (doctype.startsWith('transfer')) {
                doc.stock1 = 'stock.' + irand(0, stockcou-1) + '^' + ts
                doc.stock2 = 'stock.' + irand(0, stockcou-1) + '^' + ts
            } else if (doctype.startsWith('prod')) {
                doc.prod = 'prod.' + irand(0, prodcou-1) + '^' + ts
                doc.stock = 'stock.' + irand(0, stockcou-1) + '^' + ts
            } else {
                doc.stock = 'stock.' + irand(0, stockcou-1) + '^' + ts
            }

            doc.lines = []
            for (let j = 0; j < irand(1, maxlinecou); j++) {
                const line: any = 
                    {
                        nomen: 'nomen.' + irand(0, nomencou-1) + '^' + ts,
                        qty: doctype === 'purch.post' ? irand(1, 30*5) : irand(1, 30)
                    }
                if (doctype.startsWith('purch') || doctype.startsWith('sale')) {
                    line.price = frand(100, 300)
                } else if (doctype === 'prod') {
                    line.cost_norm = frand(100, 300)
                }
                doc.lines.push(line)
            }
            const [ok, msg] = db.add(doc)
            if (ok) {
                i++
                couall++
                cou++
                if (cou === 1000) {
                    console.log('\ngenerating "' + doctype + '" docs in-memory: ' + i + '            \x1b[2A')
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

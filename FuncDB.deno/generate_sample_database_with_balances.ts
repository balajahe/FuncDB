import { ERPCore } from './core/ERPCore.ts'
import { DBMeta } from './core/DBMeta.ts'

const dbpath = './database/'

let personcou = 5000
let nomencou = 3000
let stockcou = 50
let prodcou = 1000

let doccou = 10000
let maxlinecou = 50
const mut_scale = 1/10

let db: ERPCore

try {
    Deno.removeSync(dbpath, {recursive: true})
} catch(_) {}
Deno.mkdirSync(dbpath)
Deno.mkdirSync(dbpath + DBMeta.snapshots)
Deno.openSync(dbpath + DBMeta.data_immut, 'w').close()
Deno.openSync(dbpath + DBMeta.data_current, 'w').close()

// генерируем справочники
db = new ERPCore(dbpath)
const ts_ref = Date.now()
gen_persons()
gen_nomens()
gen_stocks()

// генерируем иммутабельные документы
gen_docs(['purch.posted', 'transfer.posted', 'sale.posted'])
db.flush_sync(false) // кэш не записываем, так как нам нужен только один датафайл
Deno.renameSync(dbpath + DBMeta.data_current, dbpath + DBMeta.data_immut)
Deno.openSync(dbpath + DBMeta.data_current, 'w').close()

// генерируем мутабельные данные
doccou = Math.floor(doccou * mut_scale)
db = new ERPCore(dbpath)
gen_prods()
gen_docs(['purch.posted', 'transfer.posted', 'sale.posted', 'prod.in.posted', 'prod.out.posted'])

// генерируем открытые (неразнесенные) документы
gen_docs(['purch.open', 'sale.open'])
db.flush_sync() // база готова вместе с кэшем


// persons (partners)
function gen_persons() {
    const person_types = ['retail', 'wholesale']
    for (let i = 0; i < personcou; i++) {
        let doc = 
            {
                type: 'person',
                id: 'person.' + i + '^' + ts_ref,
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
                id: 'nomen.' + i + '^' + ts_ref,
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
                id: 'stock.' + i + '^' + ts_ref,
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
                type: 'prod.open',
                id: 'prod.' + i + '^' + ts_ref,
                name: 'prod ' + i
            }
        doc.lines = []
        for (let j = 0; j < irand(1, maxlinecou); j++) {
            doc.lines.push(
                {
                    nomen: 'nomen.' + irand(0, nomencou-1) + '^' + ts_ref,
                    qty: irand(1, 30),
                    cost_std: frand(100, 300)
                }
            )
        }
        db.add(doc)
    } 
}

// all posted documents: purch, transfer, sale
async function gen_docs(doc_types: string[]) {
    const ts_doc = Date.now()
    const date = new Date().toISOString().substr(0,10)
    let couall = 0
    let cou = 0
    for (let doctype of doc_types) {
        const dockey = doctype.slice(0, doctype.lastIndexOf('.'))
        let i = 0
        while (i < doccou) {
            let doc: any =
                {
                    type: doctype,
                    id: dockey + '.' + i + '^' + ts_doc,
                    date: date,
                    person: 'person.' + irand(0, personcou-1) + '^' + ts_ref
                }

            if (doctype.startsWith('transfer')) {
                doc.stock1 = 'stock.' + irand(0, stockcou-1) + '^' + ts_ref
                doc.stock2 = 'stock.' + irand(0, stockcou-1) + '^' + ts_ref
            } else if (doctype.startsWith('prod')) {
                doc.prod = 'prod.' + irand(0, prodcou-1) + '^' + ts_ref
                doc.stock = 'stock.' + irand(0, stockcou-1) + '^' + ts_ref
            } else {
                doc.stock = 'stock.' + irand(0, stockcou-1) + '^' + ts_ref
            }

            doc.lines = []
            for (let j = 0; j < irand(1, maxlinecou); j++) {
                const line: any = 
                    {
                        nomen: 'nomen.' + irand(0, nomencou-1) + '^' + ts_ref,
                        qty: doctype.startsWith('purch') ? irand(1, 30*5) : irand(1, 30)
                    }
                if (doctype.startsWith('purch') || doctype.startsWith('sale')) {
                    line.price = frand(100, 300)
                } else if (doctype.startsWith('prod.out')) {
                    line.cost_std = frand(100, 300)
                }
                doc.lines.push(line)
            }
            const [ok, msg] = db.add(doc)
            if (ok) {
                i++
                couall++
                cou++
                if (cou === 1000) {
                    console.log('\ngenerating "' + doctype + '" docs in-memory: ' + i + '               \x1b[2A')
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

import { ERPCore } from './core/ERPCore.ts'
const db = ERPCore.open('./database/')

class ResultRow { // строка результирующей таблицы
    nomen_type = ''
    stock_type = ''
    person_type = ''
    debit_qty = 0
    credit_qty = 0
    constructor(nomen, stock, person) {
        this.nomen_type = nomen
        this.stock_type = stock
        this.person_type = person
    }
}

const res = db.reduce(
    (_, doc) => doc.type === 'post.purch' || doc.type === 'post.sale',
    (result, doc) => {
        doc.lines.forEach((line) => {
            // типы получаем подзапросами к базе (реально берутся из кэша)
            const nomen_type = db.get(line.nomen)?.erp_type ?? ' not found'
            const stock_type = db.get(doc.stock)?.erp_type ?? ' not found'
            const person_type = db.get(doc.person)?.erp_type ?? ' not found'

            const key = nomen_type + stock_type + person_type
            let row = result[key]
            if (row === undefined) {
                row = new ResultRow(nomen_type, stock_type, person_type)
                result[key] = row
            }
            
            switch (doc.type) {
                case 'post.purch':
                    row.debit_qty += line.qty
                    break
                case'post.sale':
                    row.credit_qty += line.qty
                    break
            }
        })
    },
    {} // Map не подходит в качестве аккумулятора, так как он не сериализуется
)

// сортируем результат
const keys = Object.keys(res)
keys.sort()

console.log('\n nomenclature type  | stock type         | person type        | + qty              | - qty              | balance            ')
console.log('=============================================================================================================================')
let cou = 0
for (const key of keys) {
    const row = res[key]
    cou++; //if (cou > 30) { console.log(' < tail skipped >'); break }
    console.log(' ' +
        row.nomen_type.padEnd(18) + ' | ' +
        row.stock_type.padEnd(18) + ' | ' +
        row.person_type.padEnd(18) + ' | ' +
        f(row.debit_qty) + ' | ' +            
        f(row.credit_qty) + ' | ' +            
        f((row.debit_qty - row.credit_qty))         
    )
}

db.add_mut(
    {
        type: 'post.purch',
        key: 'post.purch.XXX',
        date: '2020-01-21',
        person: db.get_top('person.0').id,
        stock: db.get_top('stock.0').id,
        lines: [
            {
                nomen: db.get_top('nomen.0').id,
                qty: 10000,
                price: 116.62545127448834
            }
       ]
    }
)
console.log('\n1 purch document added, run sample again')
db.flush()


function f(n: number): string {
    return n.toString().padStart(18)
}

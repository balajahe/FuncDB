import { DBCore } from './core/DBCore.ts' 
const db = DBCore.open('./sample_database/')

class ResultRow { // строка результирующей таблицы
    nomen_type = ''
    person_type = ''
    stock_type = ''
    debit_qty = 0
    debit_amount = 0
    credit_qty = 0
    credit_amount = 0
}

let res = db.reduce(
    (_, doc) => doc.type == 'purch' || doc.type == 'sale',
    (result, doc) => {
        doc.lines.forEach((line) => {
            // типы получаем подзапросами к базе (реально берутся из кэша)
            const stock_type = db.get(doc.stock)?.type ?? ' not found'
            const nomen_type = db.get(line.nomen)?.type ?? ' not found'
            const person_type = db.get(doc.person)?.type ?? ' not found'

            const key = stock_type+ nomen_type + person_type
            let row = result.get(key)
            if (row === undefined) {
                row = new ResultRow()
                row.stock_type = stock_type
                row.nomen_type = nomen_type
                row.person_type = person_type
                result.set(key, row)
            }
            
            if (doc.type === 'purch') {
                row.debit_qty += line.qty
                row.debit_amount += line.qty * line.price
            } else if (doc.type === 'sale') {
                row.credit_qty += line.qty
                row.credit_amount += line.qty * line.price
            }
        })
    },
    new Map<string, ResultRow>() // результирующая таблица
)

// сортируем результат
const keys = []
for (const key of res.keys()) keys.push(key)
keys.sort()

console.log('\nstock type | nomen type | person type | debet qty | debet amount | credit qty | credit amount | balance amount')
console.log('===================================================================================================')
let cou = 0
for (const key of keys) {
    const row = res.get(key)
    cou++; //if (cou > 20) { console.log(' < tail skipped >'); break }
    console.log('' +
        row.stock_type + ' | ' +
        row.nomen_type + ' | ' +
        row.person_type + ' | ' +
        row.debit_qty + ' | ' +            
        row.debit_amount + ' | ' +            
        row.credit_qty + ' | ' +            
        row.credit_amount + ' | ' +            
        (row.debit_amount - row.credit_amount)          
    )
}

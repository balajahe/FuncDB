import { FuncDB } from "./FuncDB.ts"

const db = FuncDB.open('./sample_database/')

let res = await db.reduce(
    (_, doc) => doc.type == 'purch' || doc.type == 'sale',
    (result, doc) => {
        doc.lines.forEach(async function(line) { // цикл по строкам
            const key = line.invent + doc.partner
            let row = result.get(key)
            if (row === undefined) {
                row = {
                    // подзапросы для получения наименований
                    invent_name: (await db.get(line.invent)).name,
                    partner_name: (await db.get(doc.partner)).name,
                    debit_qty: 0,
                    debit_amount: 0,
                    credit_qty: 0,
                    credit_amount: 0
                }
                result.set(key, row)
            }
            if (doc.type == 'purch') {
                row.debit_qty += line.qty
                row.debit_amount += line.qty * line.price
            } else if (doc.type == 'sale') {
                row.credit_qty += line.qty
                row.credit_amount += line.qty * line.price
            }
        })
    },
    new Map() // результат - таблица комбинаций товар-партнер
)
console.log('\ninvent name | partner name | debet qty | debet amount | credit qty | credit amount | balance amount')
console.log('===================================================================================================')
let cou = 0
for (const row of res.values()) {
    cou++
    console.log('' +
        row.invent_name + ' | ' +
        row.partner_name + ' | ' +
        row.debit_qty + ' | ' +            
        row.debit_amount + ' | ' +            
        row.credit_qty + ' | ' +            
        row.credit_amount + ' | ' +            
        (row.debit_amount - row.credit_amount)          
    )
}

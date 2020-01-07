import { FuncDB } from "./FuncDB.ts"
const db = FuncDB.open('./sample_database/')

class ResultRow { // строка результирующей таблицы
    invent_name = ''
    partner_name = ''
    debit_qty = 0
    debit_amount = 0
    credit_qty = 0
    credit_amount = 0
}

let res = await db.reduce(
    async (_, doc) => doc.type == 'purch' || doc.type == 'sale',
    async (result, doc) => {
        // поскольку внутри цикла у нас await - параллелим обработку строк
        const promises = doc.lines.map(async (line) => {
            const key = line.invent + doc.partner
            let row = result.get(key)
            if (row === undefined) {
                row = new ResultRow()
                // наименования получаем подзапросами к базе (они кэшируются)
                const invent = await db.get(line.invent)
                const partner = await db.get(doc.partner)
                row.invent_name = invent ? invent.name : line.invent + ' not found'
                row.partner_name = partner ? partner.name : doc.partner + ' not found'
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
        await Promise.all(promises)
    },
    new Map<string, ResultRow>() // результирующая таблица
)
console.log('\ninvent name | partner name | debet qty | debet amount | credit qty | credit amount | balance amount')
console.log('===================================================================================================')
let cou = 0
for (const row of res.values()) {
    cou++; if (cou > 10) { console.log(' < tail skipped >'); break }
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

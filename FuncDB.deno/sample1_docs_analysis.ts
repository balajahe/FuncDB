import { ERPCore } from './core/ERPCore.ts'
const db = new ERPCore('./database/')

class ResultRow { // строка результирующей таблицы
    doctype = ''
    doccou = 0
    linecou = 0
    amount = 0
    constructor(type) { this.doctype = type }
}

const res = db.reduce(
    (_, doc) => doc.type.startsWith('purch') || doc.type.startsWith('transfer') || doc.type.startsWith('sale') || doc.type.startsWith('prod'),
    (result, doc) => {
        let row = result[doc.type]
        if (row === undefined) {
            row = new ResultRow(doc.type)
            result[doc.type] = row
        }
        row.doccou++
        doc.lines.forEach(line => { // цикл по строкам документа
            row.linecou++
            if (line.price !== undefined) {
                row.amount += line.qty + line.price
            } else if (line.cost !== undefined) {
                row.amount += line.qty + line.cost
            } else {
                row.amount += line.qty + line.cost_std
            }
        })
    },
    {} // инициализируем аккумулятор - Map не подходит, так как он не сериализуется
)

let r: any
for (r of Object.values(res)) {
    console.log('\n==========================================' + 
        '\n "' + r.doctype + '" documents count = ' + r.doccou +
        '\n amount total = ' + r.amount +
        '\n amount per document = ' + r.amount / r.doccou +
        '\n lines per document = ' + r.linecou / r.doccou
    )
}

const [ok, msg] = db.add(
    {
        type: 'sale.posted',
        key: 'sale.XXX',
        date: '2020-01-21',
        person: db.get_top('person.0').id,
        stock: db.get_top('stock.0').id,
        lines: [
            {
                nomen: db.get_top('nomen.0').id,
                qty: 2000,
                price: 295.5228788368553
            }
        ]
    }
)
if (ok) {
    console.log('\n1 sale document added, run sample again')
} else {
    console.log('\n' + msg)
    console.log('Run "sample2_invent_turnover_balance.ts" to adding purch')
}
db.flush_sync(true, false)
//db.flush_sync()

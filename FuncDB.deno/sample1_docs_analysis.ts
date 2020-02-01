import { ERPCore } from './core/ERPCore.ts'
const db = ERPCore.open('./database/')  

class ResultRow { // строка результирующей таблицы
    doctype = ''
    doccou = 0
    linecou = 0
    amount = 0
    constructor(type) { this.doctype = type }
}

const res = db.reduce(
    (_, doc) => doc.type.startsWith('post.') || doc.type.startsWith('open.'),
    (result, doc) => {
        let row = result[doc.type]
        if (row === undefined) {
            row = new ResultRow(doc.type)
            result[doc.type] = row
        }
        row.doccou++
        doc.lines.forEach(line => { // цикл по строкам документа
            row.linecou++
            row.amount += line.price * line.qty // у строк перемещений нет цены, поэтому получим NaN
        })
    },
    {} // инициализируем аккумулятор - Map не подходит, так как он не сериализуется
)

let r: any
for (r of Object.values(res)) {
    console.log('\n=======================================' + 
        '\ndocuments count "' + r.doctype + '" = ' + r.doccou +
        '\namount total = ' + r.amount +
        '\namount per document = ' + r.amount / r.doccou +
        '\nlines per document = ' + r.linecou / r.doccou
    )
}

const [ok, msg] = db.add_mut(
    {
        type: 'post.sale',
        key: 'post.sale.XXX',
        date: '2020-01-21',
        person: db.get_top('person.0').id,
        stock: db.get_top('stock.0').id,
        lines: [
            {
                nomen: db.get_top('nomen.0').id,
                qty: 20,
                price: 295.5228788368553
            }
        ]
    }
)
if (ok) {
    console.log('\n1 sale document added, run this sample again')
} else {
    console.log('\nError adding sale: ' + msg)
    console.log('Run "sample2_invent_turnover_balance.ts" to adding purch')
}
db.flush(false, false)
//db.flush()

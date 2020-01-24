import { DBCore } from './core/DBCore.ts'
const db = DBCore.open('./sample_database/')  

const res = db.reduce(
    (_, doc) => doc.type == 'sale', // фильтруем только продажи
    (result, doc) => {
        result.doccou++
        doc.lines.forEach(line => { // цикл по строкам документа
            result.linecou++
            result.amount += line.price * line.qty
        })
    },
    { amount: 0, doccou: 0, linecou: 0 }, // инициализируем аккумулятор
)
console.log('\n=======================================' + 
    '\nsale documents count = ' + res.doccou +
    '\namount total = ' + res.amount +
    '\namount per document = ' + res.amount / res.doccou +
    '\nlines per document = ' + res.linecou / res.doccou
)

const [ok, msg] = db.add_mut(
    {
        type: 'sale',
        key: 'sale.XXX',
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
    console.log('\n1 sale document added, run sample again')
    db.flush()
} else {
    console.log('\nError adding sale: ' + msg)
    console.log('Run "sample3_invent_turnover_balance.ts" to adding purch')
}

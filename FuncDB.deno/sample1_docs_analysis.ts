import { DBCore } from './core/DBCore.ts'
const db = DBCore.open('./database/')  

const res = db.reduce(
    (_, doc) => doc.type == 'purch' || doc.type == 'transfer' || doc.type == 'sale',
    (result, doc) => {
        switch (doc.type) {
            case 'purch':
                calc(result.purch)
                break
            case 'transfer':
                calc(result.transfer)
                break
            case 'sale':
                calc(result.sale)
                break
        }

        function calc(res) {
            res.doccou++
            doc.lines.forEach(line => { // цикл по строкам документа
                res.linecou++
                res.amount += line.price * line.qty
                // у строк перемещений нет цены, поэтому полчим NaN
            })
        }
        
    },
    {   // инициализируем аккумулятор-результат
        purch: { amount: 0, doccou: 0, linecou: 0 },
        transfer: { amount: 0, doccou: 0, linecou: 0 },
        sale: { amount: 0, doccou: 0, linecou: 0 }
    }
)
out('purch', res.purch)
out('transfer', res.transfer)
out('sale', res.sale)

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
    console.log('\n1 sale document added, run this sample again')
} else {
    console.log('\nError adding sale: ' + msg)
    console.log('Run "sample2_invent_turnover_balance.ts" to adding purch')
}
//db.flush(false, false)
db.flush()

function out(doctype, res) {
    console.log('\n=======================================' + 
        '\n' + doctype + ' documents count = ' + res.doccou +
        '\namount total = ' + res.amount +
        '\namount per document = ' + res.amount / res.doccou +
        '\nlines per document = ' + res.linecou / res.doccou
    )
}

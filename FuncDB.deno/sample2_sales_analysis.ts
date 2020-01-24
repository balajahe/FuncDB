import { DBCore } from './core/DBCore.ts'

function calc(db: DBCore) {
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
    console.log(`
=======================================
sale documents count = ${res.doccou}
amount total = ${res.amount}
amount per document = ${res.amount / res.doccou}
lines per document = ${res.linecou / res.doccou}`
    )
}

const db = DBCore.open('./sample_database/')  
calc(db)
const [ok, msg] = db.add_mut(
    {
        sys: {
            class: 'sale',
            code: 'sale.XXX'
        },
        type: 'sale',
        date: '2020-01-21',
        person: db.get_top('person.0').sys.id,
        stock: db.get_top('stock.0').sys.id,
        lines: [
            {
                nomen: db.get_top('nomen.0').sys.id,
                qty: 20,
                price: 295.5228788368553
            }
        ]
    }
)
if (ok) {
    calc(db)
} else {
    console.log('\nError adding sale: ' + msg)
    console.log('Run sample3_invent_turnover_balance.ts to adding purch')
}
db.flush()

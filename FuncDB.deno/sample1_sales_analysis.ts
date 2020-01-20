import { DBCore } from './core/DBCore.ts' 
const db = DBCore.open('./sample_database/')  
 
calc(db)
/*
db.add_immut(JSON.parse(`
    {
        "sys": {
            "code": "sale.xxx"
        },
        "type": "sale",
        "date": "2020-01-07",
        "partner": "partner.xxx^1577698000000",
        "lines": [
            {
                "invent": "invent.xxx^1577698000000",
                "qty": 33,
                "price": 333
            }
        ]
    }
`))
*/
calc(db)

function calc(db: DBCore) {
    let res = db.reduce(
        (_, doc) => doc.type == 'sale', // фильтруем только продажи
        (result, doc) => {
            result.doccou++
            doc.lines.forEach(line => { // цикл по строкам документа
                result.linecou++
                result.amount += line.price * line.qty
            })
        },
        {amount: 0, doccou: 0, linecou: 0} // инициализируем аккумулятор
    )
    console.log(`
        amount total = ${res.amount}
        amount per document = ${res.amount / res.doccou}
        lines per document = ${res.linecou / res.doccou}`
    )
}

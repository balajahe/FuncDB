import { FuncDB } from "./FuncDB.ts"

const db = FuncDB.open('./sample_database/')
await calc(db)
db.add(JSON.parse(`
    {
        "sys": {
            "code": "sale.xxx"
        },
        "type": "sale",
        "partner": "partner.xxx|1577698000000",
        "lines": [
            {
                "invent": "invent.xxx|1577698000000",
                "qty": 33,
                "price": 333
            }
        ]
    }
`))
await calc(db)

async function calc(db: FuncDB) {
    let res = await db.reduce(
        (_, doc) => doc.type == 'sale', // фильтруем только продажи
        (result, doc) => {
            result.doccou++
            doc.lines.forEach(line => { // цикл по строкам
                result.linecou++
                result.amount += line.price * line.qty
            })
        },
        {amount: 0, doccou: 0, linecou: 0} // инициируем аккумулятор
    )
    console.log(`
        amount total = ${res.amount}
        amount per document = ${res.sum / res.doccou}
        lines per document = ${res.linecou / res.doccou}`
    )
}

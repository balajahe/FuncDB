import { FuncDB } from './FuncDB.ts'
const db = FuncDB.open('./sample_database/')

await calc(db)
db.add(JSON.parse(`
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
await calc(db)

async function calc(db: FuncDB) {
    let res = await db.reduce(
        async (_, doc) => doc.type == 'sale', // фильтруем только продажи
        async (result, doc) => {
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

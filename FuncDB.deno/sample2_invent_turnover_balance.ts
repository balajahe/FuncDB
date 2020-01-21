import { DBCore } from './core/DBCore.ts' 

class ResultRow { // строка результирующей таблицы
    nomen_type = ''
    person_type = ''
    stock_type = ''
    debit_qty = 0
    debit_amount = 0
    credit_qty = 0
    credit_amount = 0
}

function calc(db: DBCore) {
    const res = db.reduce(
        (_, doc) => doc.type == 'purch' || doc.type == 'sale',
        (result, doc) => {
            doc.lines.forEach((line) => {
                // типы получаем подзапросами к базе (реально берутся из кэша)
                const stock_type = db.get(doc.stock)?.type ?? ' not found'
                const nomen_type = db.get(line.nomen)?.type ?? ' not found'
                const person_type = db.get(doc.person)?.type ?? ' not found'

                const key = stock_type+ nomen_type + person_type
                let row = result[key]
                if (row === undefined) {
                    row = new ResultRow()
                    row.stock_type = stock_type
                    row.nomen_type = nomen_type
                    row.person_type = person_type
                    result[key] = row
                }
                
                if (doc.type === 'purch') {
                    row.debit_qty += line.qty
                    row.debit_amount += line.qty * line.price
                } else if (doc.type === 'sale') {
                    row.credit_qty += line.qty
                    row.credit_amount += line.qty * line.price
                }
            })
        },
        {} // не можем использовать Map в качестве результата, так как он не сериализуется
    )

    // сортируем результат
    const keys = Object.keys(res)
    keys.sort()

    console.log('\nstock type | nomen type | person type | debet qty | debet amount | credit qty | credit amount | balance amount')
    console.log('==============================================================================================================')
    let cou = 0
    for (const key of keys) {
        const row = res[key]
        cou++; //if (cou > 20) { console.log(' < tail skipped >'); break }
        console.log('' +
            row.stock_type + ' | ' +
            row.nomen_type + ' | ' +
            row.person_type + ' | ' +
            row.debit_qty + ' | ' +            
            row.debit_amount + ' | ' +            
            row.credit_qty + ' | ' +            
            row.credit_amount + ' | ' +            
            (row.debit_amount - row.credit_amount)          
        )
    }
}

const db = DBCore.open('./sample_database/')
calc(db)
db.add_mut(JSON.parse(`
    {
        "sys": {
            "class": "purch",
            "code": "purch.2"
        },
        "type": "purch",
        "date": "2020-01-21",
        "person": "${db.get_top('person.0').sys.id}",
        "stock": "${db.get_top('stock.0').sys.id}",
        "lines": [
            {
                "nomen": "${db.get_top('nomen.0').sys.id}",
                "qty": 24,
                "price": 116.62545127448834
            },
            {
                "nomen": "${db.get_top('nomen.1').sys.id}",
                "qty": 50,
                "price": 333.62545127448834
            }
        ]
    }
`))
calc(db)
db.flush()

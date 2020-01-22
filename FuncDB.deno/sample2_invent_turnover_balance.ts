import { DBCore } from './core/DBCore.ts' 

class ResultRow { // строка результирующей таблицы
    nomen_type = ''
    stock_type = ''
    person_type = ''
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
                const nomen_type = db.get(line.nomen)?.type ?? ' not found'
                const stock_type = db.get(doc.stock)?.type ?? ' not found'
                const person_type = db.get(doc.person)?.type ?? ' not found'

                const key = nomen_type + stock_type + person_type
                let row = result[key]
                if (row === undefined) {
                    row = new ResultRow()
                    row.nomen_type = nomen_type
                    row.stock_type = stock_type
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
        {}, // Map не подходит в качестве аккумулятора, так как он не сериализуется
    )

    // сортируем результат
    const keys = Object.keys(res)
    keys.sort()

    console.log('\nnomen type       | stock type       | person type      | + qty  | debet amount      | - qty  | credit amount     | balance amount    ')
    console.log('=====================================================================================================================================')
    let cou = 0
    for (const key of keys) {
        const row = res[key]
        cou++; //if (cou > 20) { console.log(' < tail skipped >'); break }
        console.log('' +
            row.nomen_type.padEnd(16) + ' | ' +
            row.stock_type.padEnd(16) + ' | ' +
            row.person_type.padEnd(16) + ' | ' +
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

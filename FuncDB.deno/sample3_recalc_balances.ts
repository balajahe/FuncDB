import { DBCore } from './core/DBCore.ts'

const db = DBCore.open('./sample_database/')  

// считаем все комбинации по всем документам за 1 проход
class Row { bal = 0 }
const bals = db.reduce(
    (_, doc) => doc.sys.slass === 'purch' || doc.sys.class === 'sale' || doc.sys.class === 'transfer',
    (result, doc) => {
        doc.lines.forEach((line) => {
            switch (doc.sys.class) {
                case 'purch':
                    calc(key(line.nomen, doc.stock), +1)
                    break
                case 'sale':
                    calc(key(line.nomen, doc.stock), -1)
                    break
                case 'thansfer':
                    calc(key(line.nomen, doc.stock1), -1)
                    calc(key(line.nomen, doc.stock2), +1)
                    break
            }

            function key(id1, id2) { 
                return db.code_from_id(id1) + '|' +  db.code_from_id(id2)
            }
            
            function calc(key, sign) {
                let row = result[key]
                if (row === undefined) {
                    row = new Row()
                    result[key] = row  
                }   
                row.bal += line.qty * sign
            }
        })
    },
    {}, // Map не подходит в качестве аккумулятора, так как он не сериализуется
)

// добавляем документы балансов в базу
let cou = 0
for (const key of Object.keys(bals)) {
    db.add_mut({ sys: { class: 'bal_qty', code: key }, value: bals[key].bal })
    cou ++
}
console.log('\nadded balances = ' + cou)
db.flush()

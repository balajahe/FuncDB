import { DBCore } from './core/DBCore.ts'
const db = DBCore.open('./database/')  

class ResultRow {
    key = ''
    qty_purch = 0
    val_purch = 0
    qty = 0
}

// считаем все комбинации по всем документам за 1 проход
const bals = db.reduce(
    (_, doc) => doc.type === 'purch' || doc.type === 'sale' || doc.type === 'transfer',
    (result, doc) => {
        doc.lines.forEach((line) => {
            switch (doc.type) {
                case 'purch':
                    calc(key(line.nomen, doc.stock), +1, true)
                    break
                case 'sale':
                    calc(key(line.nomen, doc.stock), -1)
                    break
                case 'transfer':
                    calc(key(line.nomen, doc.stock1), -1)
                    calc(key(line.nomen, doc.stock2), +1)
                    break
            }

            function key(id1, id2) { 
                return 'bal' + '|' + db.key_from_id(id1) + '|' +  db.key_from_id(id2)
            }
            
            function calc(key, sign, purch = false) {
                let row = result[key]
                if (row === undefined) {
                    row = new ResultRow()
                    row.key = key
                    result[key] = row
                }   
                row.qty += line.qty * sign
                if (purch) {
                    row.qty_purch += line.qty * sign
                    row.val_purch += line.qty * line.price * sign
                }
            }
        })
    },
    {}, // Map не подходит в качестве аккумулятора, так как он не сериализуется
    true // не кэшируем результат, так как бессмысленно, и он большой
)

// проверяем баланс на актуальность, и если не сходится - добавляем правильный в базу
let cou = 0
for (const key of Object.keys(bals)) {
    const new_bal = bals[key]
    const old_bal = db.get_top(key, true)
    if (new_bal.qty !== old_bal?.qty ?? 0) {
        db.add_mut(
            { 
                type: 'bal', 
                key: key, 
                qty: new_bal.qty,
                val: new_bal.val_purch * new_bal.qty / new_bal.qty_purch
        })
        cou ++
    }
}
console.log('\nadded balances: ' + cou)
if (cou > 0) {
    db.flush()
}

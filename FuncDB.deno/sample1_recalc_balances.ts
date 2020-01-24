import { DBCore } from './core/DBCore.ts'
const db = DBCore.open('./sample_database/')  

// считаем все комбинации по всем документам за 1 проход
const bals = db.reduce(
    (_, doc) => doc.type === 'purch' || doc.type === 'sale' || doc.type === 'transfer',
    (result, doc) => {
        doc.lines.forEach((line) => {
            switch (doc.type) {
                case 'purch':
                    calc(key(line.nomen, doc.stock), +1)
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
            
            function calc(key, sign) {
                let row = result[key]
                if (row === undefined) {
                    result[key] = 0  
                }   
                result[key] += line.qty * sign
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
    const old_bal = db.get_top(key, true)?.val ?? 0
    if (new_bal !== old_bal) {
        db.add_mut({ type: 'bal', key: key, val: new_bal })
        cou ++
    }
}
console.log('\nadded balances: ' + cou)
if (cou > 0) {
    db.flush()
}

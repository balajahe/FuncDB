import { DBCore } from './core/DBCore.ts'
const db = DBCore.open('./sample_database/')  

// считаем все комбинации по всем документам за 1 проход
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
    const newbal = bals[key]
    const oldbal = db.get_top(key, true)?.value ?? 0
    if (newbal !== oldbal) {
        db.add_mut({ sys: { class: 'bal_qty', code: key }, value: newbal })
        cou ++
    }
}
console.log('\nadded balances: ' + cou)
db.flush()

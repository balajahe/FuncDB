import { DBCore } from './core/DBCore.ts' 
const db = DBCore.open('./sample_database/')

class ResultRow { // строка результирующей таблицы
    nomen_name = ''
    qty = 0
    revenue = 0
    cost = 0
}

const res = db.reduce(
    (_, doc) => doc.type == 'sale',
    (result, doc) => {
        doc.lines.forEach((line) => {
            // наименования номенклатур получаем подзапросами к базе (реально берутся из кэша)
            const nomen_name = db.get(line.nomen)?.name ?? ' not found'
            const key = nomen_name
            let row = result[key]
            if (row === undefined) {
                row = new ResultRow()
                row.nomen_name = nomen_name
                result[key] = row
            }
                row.qty += line.qty
                row.revenue += line.qty * line.price
                row.cost += line.qty * line.cost
        })
    },
    {} // Map не подходит в качестве аккумулятора, так как он не сериализуется
)

// сортируем результат
const keys = Object.keys(res)
keys.sort()

console.log('\n nomencl. name  | qty  | sales revenue      | costs              | sales margin       ')
console.log('======================================================================================')
let cou = 0
for (const key of keys) {
    const row = res[key]
    cou++; if (cou > 20) { console.log(' < tail skipped >'); break }
    console.log('' +
        row.nomen_name.padEnd(15) + ' | ' +
        row.qty + ' | ' +            
        row.revenue + ' | ' +            
        row.cost + ' | ' +                        
        (row.revenue - row.cost)          
    )
}
db.flush()

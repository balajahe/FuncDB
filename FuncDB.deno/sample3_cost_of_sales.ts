import { ERPCore } from './core/ERPCore.ts'
const db = ERPCore.open('./database/')

class ResultRow { // строка результирующей таблицы
    nomen_name = ''
    qty = 0
    revenue = 0
    cost = 0
    constructor(name) { this.nomen_name = name }
}

const res = db.reduce(
    (_, doc) => doc.type === 'sale.post',
    (result, doc) => {
        doc.lines.forEach((line) => {
            // наименования номенклатур получаем подзапросами к базе (реально берутся из кэша)
            const nomen_name = db.get(line.nomen)?.name ?? ' not found'
            let row = result[nomen_name]
            if (row === undefined) {
                row = new ResultRow(nomen_name)
                result[nomen_name] = row
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

console.log('\n nomenclature name  | qty                | sales revenue      | costs              | sales margin       ')
console.log('========================================================================================================')
let cou = 0
for (const key of keys) {
    const row = res[key]
    cou++; if (cou > 30) { console.log(' < tail skipped >'); break }
    console.log(' ' +
        row.nomen_name.padEnd(18) + ' | ' +
        f(row.qty) + ' | ' +            
        f(row.revenue) + ' | ' +            
        f(row.cost) + ' | ' +                        
        f((row.revenue - row.cost))          
    )
}
db.flush()


function f(n: number): string {
    return n.toString().padStart(18)
}

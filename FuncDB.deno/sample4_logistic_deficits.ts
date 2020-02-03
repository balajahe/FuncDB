import { ERPCore } from './core/ERPCore.ts'
const db = ERPCore.open('./database/')

class ResultRow {
    bal_key = ''
    in_stock = 0
    expected = 0
    needs = 0
    deficit = 0
    p_deficit = 0
    constructor(key) { this.bal_key = key }
}

const res = db.reduce_top(
    (_, doc) => doc.type === 'bal' && -doc.oqty > doc.qty + doc.iqty,
    (result, doc) => {
        let row = result[doc.key]
        if (row === undefined) {
            row = new ResultRow(doc.key)
            result[doc.key] = row
        }
        row.in_stock = doc.qty
        row.expected = doc.iqty
        row.needs = doc.oqty
        row.deficit = row.in_stock + row.expected + row.needs
        row.p_deficit = -row.deficit / (row.in_stock + row.expected) * 100
    },
    {}
)

let rows: any[] = Object.values(res)
rows.sort((a, b) => b.p_deficit - a.p_deficit)

console.log('\n balance key          | in stock | expected | needs    | deficit  | deficit %')
console.log('=============================================================================')
let cou = 0
for (const row of rows) {
    cou++; if (cou > 30) { console.log(' < tail skipped >'); break }
    console.log(' ' +
        row.bal_key.slice(4).padEnd(20) + ' | ' +
        f(row.in_stock) + ' | ' +            
        f(row.expected) + ' | ' +                        
        f(row.needs) + ' | ' +            
        f(row.deficit) + ' | ' +            
        f(row.p_deficit)         
    )
}
db.flush()


function f(n: number): string {
    return n.toFixed().padStart(8)
}

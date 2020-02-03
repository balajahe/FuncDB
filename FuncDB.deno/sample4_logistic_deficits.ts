import { ERPCore } from './core/ERPCore.ts'
const db = ERPCore.open('./database/')

class ResultRow {
    bal_key = ''
    in_stock = 0
    expected = 0
    needs = 0
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
    },
    {}
)
const keys = Object.keys(res)
keys.sort()

console.log('\n balance key         | in stock | expected | needs | deficit ')
console.log('============================================================')
let cou = 0
for (const key of keys) {
    const row = res[key]
    cou++; if (cou > 30) { console.log(' < tail skipped >'); break }
    console.log('' +
        row.bal_key.slice(4).padEnd(20) + ' | ' +
        row.in_stock + ' | ' +            
        row.expected + ' | ' +                        
        row.needs + ' | ' +            
        (row.in_stock + row.expected + row.needs)          
    )
}
db.flush()

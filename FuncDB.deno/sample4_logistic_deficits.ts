import { ERPCore } from './core/ERPCore.ts'
const db = new ERPCore('./database/')

class ResultRow {
    key = ''
    in_stock = 0
    expected = 0
    needs = 0
    deficit = 0
    p_deficit = 0
    constructor(key) { this.key = key }
}

const res = db.reduce_top(
    (_, doc) => doc.type.startsWith('bal'),
    (result, doc) => {
        const key = doc.key.slice(doc.key.indexOf('|')+1)
        let row = result[key]
        if (row === undefined) {
            row = new ResultRow(key)
            result[key] = row
        }
        switch (doc.type) {
            case 'bal=':
                row.in_stock += doc.qty
                break
            case 'bal+':
                row.expected += doc.qty
                break
            case 'bal-':
                row.needs += doc.qty
                break
        }
        row.deficit = row.in_stock + row.expected + row.needs
        row.p_deficit = -row.deficit / (row.in_stock + row.expected) * 100
    },
    {}
)

let rows = (<ResultRow[]>Object.values(res)).filter(v => v.deficit < 0)
rows.sort((a, b) => b.p_deficit - a.p_deficit)

console.log('\n balance key          | in stock | expected | needs    | deficit  | % deficit')
console.log('==============================================================================')
let cou = 0
for (const row of rows) {
    cou++; if (cou > 30) { console.log(' < tail skipped >'); break }
    console.log(' ' +
        row.key.padEnd(20) + ' | ' +
        f(row.in_stock) + ' | ' +            
        f(row.expected) + ' | ' +                        
        f(row.needs) + ' | ' +            
        f(row.deficit) + ' | ' +            
        f(row.p_deficit)         
    )
}
db.flush_sync()


function f(n: number): string {
    return n.toFixed().padStart(8)
}

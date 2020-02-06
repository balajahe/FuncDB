import { ERPCore } from './core/ERPCore.ts'
const db = new ERPCore('./database/')

db.recreate_bals()

/*
const [ok, msg] = db.add(
    {
        type: 'sale.post',
        key: 'sale.XXX',
        date: '2020-01-21',
        person: db.get_top('person.0').id,
        stock: db.get_top('stock.0').id,
        lines: [
            {
                nomen: db.get_top('nomen.0').id,
                qty: 2000,
                price: 295.5228788368553
            }
        ]
    }
)
if (ok) {
    console.log('\n1 sale document added, run this sample again')
    db.recreate_bals()
} else {
    console.log('\nError adding sale: ' + msg)
    console.log('Run "sample2_invent_turnover_balance.ts" to adding purch')
}
*/

db.flush_sync()

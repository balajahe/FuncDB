import { Document, DocMeta, IDBCore } from '../core/DBMeta.ts'

export default class Sale extends DocMeta {
    static before_add(doc: Document, db: IDBCore): [boolean, string?] {
        let err = ''
        doc.lines.forEach(line => {
            const key = 'bal' + '|' + db.key_from_id(line.nomen) + '|' + db.key_from_id(doc.stock)
            const bal = db.get_top(key, true) // true - запрет скана, ищем только в топ-кэше
            const bal_qty = bal?.qty ?? 0 // остаток количества
            const bal_val = bal?.val ?? 0 // остаток суммы
            if (bal_qty < line.qty) {
                err += '\n"' + key + '": requested ' + line.qty + ' but balance is only ' + bal_qty
            } else {
                line.cost = bal_val / bal_qty // себестоимость в момент списания
                line.from = bal.id
            }
        })
        return  err !== '' ? [false, err] : [true,]
    }

    static after_add(doc: Document, db: IDBCore): void {
        doc.lines.forEach(line => {
            const key = 'bal' + '|' + db.key_from_id(line.nomen) + '|' + db.key_from_id(doc.stock)
            const bal = db.get_top(key, true)
            const bal_qty = bal?.qty ?? 0
            const bal_val = bal?.val ?? 0
            db.add_mut(
                { 
                    type: 'bal', 
                    key: key,
                    qty: bal_qty - line.qty,
                    val: bal_val - line.cost * line.qty // cost вычислен в before_add()
                }
            )
        })
    }
}

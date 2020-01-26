import { Document, DocClass, IDBCore } from '../core/DBMeta.ts'

export default class Purch extends DocClass {
    static after_add(doc: Document, db: IDBCore): void {
        doc.lines.forEach(line => {
            const key = 'bal' + '|' + db.key_from_id(line.nomen) + '|' + db.key_from_id(doc.stock)
            const bal = db.get_top(key, true) // true - запрет скана, ищем только в топ-кэше
            const bal_qty = bal?.qty ?? 0
            const bal_val = bal?.val ?? 0
            db.add_mut(
                { 
                    type: 'bal', 
                    key: key, 
                    qty: bal_qty + line.qty,
                    val: bal_val + line.qty * line.price
                }
            )
        })
    }
}

import { Document, DocClass, IDBCore } from '../core/DBMeta.ts'

export default class sale extends DocClass {
    static before_add(doc: Document, db: IDBCore): true | string {
        for (let line of doc.lines) {
            const bal_key = db.code_from_id(line.nomen) + '|' + db.code_from_id(doc.stock)
            const bal = db.get_top(bal_key)?.value ?? 0
            if (bal < line.qty) return `"${bal_key}": requested ${line.qty} but balance is only ${bal}`
        }
        return true
    }

    static after_add(doc: Document, db: IDBCore): void {
        doc.lines.forEach(line => {
            const bal_key = db.code_from_id(line.nomen) + '|' + db.code_from_id(doc.stock)
            const bal_old = db.get_top(bal_key)?.value ?? 0
            const bal_new = {sys: {class: "bal_qty", code: bal_key}, value: bal_old - line.qty}
            db.add_mut(bal_new)
        })
    }
}

import { Document, DocClass, IDBCore } from '../core/DBMeta.ts'

export default class extends DocClass {
    static after_add(doc: Document, db: IDBCore): void {
        doc.lines.forEach(line => {
            const balkey = db.code_from_id(line.nomen) + '|' + db.code_from_id(doc.stock)
            let bal = {sys: {class: "bal_qty", code: balkey}, value: line.qty}
            db.add_mut(bal)
        })
    }
}

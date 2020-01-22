import { Document, DocClass, IDBCore } from '../core/DBMeta.ts'

export default class purch extends DocClass {
    static after_add(doc: Document, db: IDBCore): void {
        doc.lines.forEach(line => {
            const bal_key = db.code_from_id(line.nomen) + '|' + db.code_from_id(doc.stock)
            /*
            const bal_old = db.reduce(
                (res, doc) => doc.sys.class === 'bal_qty' && doc.sys.code === res.bal,
                (res, doc) => { res.bal += doc.value },
                { key: bal_key, bal: 0 },
            )
            */
            const bal_old = db.get_top(bal_key)?.value ?? 0
            const bal_new = {sys: {class: "bal_qty", code: bal_key}, value: bal_old + line.qty}
            db.add_mut(bal_new)
        })
    }
}

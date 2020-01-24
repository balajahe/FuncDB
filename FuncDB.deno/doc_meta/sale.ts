import { Document, DocMeta, IDBCore } from '../core/DBMeta.ts'

export default class sale extends DocMeta {
    static before_add(doc: Document, db: IDBCore): [boolean, string?] {
        for (let line of doc.lines) {
            const bal_key = 'bal' + '|' + db.key_from_id(line.nomen) + '|' + db.key_from_id(doc.stock)
            // второй параметр get() - запрет скана, ищем только в топ-кэше
            const bal_doc = db.get_top(bal_key, true)
            const bal = bal_doc?.val ?? 0
            if (bal < line.qty) {
                return [false, `"${bal_key}": requested ${line.qty} but balance is only ${bal}`]
            } else {
                line.from = bal_doc.id
                return [true,]
            }
        }
    }

    static after_add(doc: Document, db: IDBCore): void {
        doc.lines.forEach(line => {
            const bal_key = 'bal' + '|' + db.key_from_id(line.nomen) + '|' + db.key_from_id(doc.stock)
            const bal_old = db.get_top(bal_key, true)?.val ?? 0
            const bal_new = { type: 'bal', key: bal_key, val: bal_old - line.qty }
            db.add_mut(bal_new)
        })
    }
}

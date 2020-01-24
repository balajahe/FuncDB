import { Document, DocMeta, IDBCore } from '../core/DBMeta.ts'

export default class sale extends DocMeta {
    static before_add(doc: Document, db: IDBCore): [boolean, string?] {
        for (let line of doc.lines) {
            const bal_key = 'bal' + '|' + db.key_from_id(line.nomen) + '|' + db.key_from_id(doc.stock1)
            // второй параметр get() - запрет скана, ищем только в топ-кэше
            const bal_old = db.get_top(bal_key, true)?.val ?? 0
            if (bal_old < line.qty) return [false, `"${bal_key}": requested ${line.qty} but balance is only ${bal_old}`]
        }
        return [true,]
    }

    static after_add(doc: Document, db: IDBCore): void {
        doc.lines.forEach(line => {
            let bal_key = 'bal' + '|' + db.key_from_id(line.nomen) + '|' + db.key_from_id(doc.stock1)
            let bal_old = db.get_top(bal_key, true)?.val ?? 0
            let bal_new = { type: 'bal', key: bal_key, val: bal_old - line.qty }
            db.add_mut(bal_new)

            bal_key = 'bal' + '|' + db.key_from_id(line.nomen) + '|' + db.key_from_id(doc.stock2)
            bal_old = db.get_top(bal_key, true)?.val ?? 0
            bal_new = { type: 'bal', key: bal_key, val: bal_old + line.qty }
            db.add_mut(bal_new)
        })
    }
}

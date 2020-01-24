import { Document, DocMeta, IDBCore } from '../core/DBMeta.ts'

export default class purch extends DocMeta {
    static after_add(doc: Document, db: IDBCore): void {
        doc.lines.forEach(line => {
            const bal_key = 'bal' + '|' + db.key_from_id(line.nomen) + '|' + db.key_from_id(doc.stock)
            /*
            const bal_old = db.reduce(
                (res, doc) => doc.type === 'bal' && doc.key === res.bal_key,
                (res, doc) => { res.bal += doc.val },
                { bal_key: bal_key, bal: 0 },
            )
            */
            // второй параметр get() - запрет скана, ищем только в топ-кэше
            const bal_old = db.get_top(bal_key, true)?.val ?? 0 
            const bal_new = { type: 'bal', key: bal_key, val: bal_old + line.qty }
            db.add_mut(bal_new)
        })
    }
}

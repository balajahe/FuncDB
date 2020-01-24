import { Document, DocClass, IDBCore } from '../core/DBMeta.ts'

export default class sale extends DocClass {
    static before_add(doc: Document, db: IDBCore): [boolean, string?] {
        for (let line of doc.lines) {
            const bal_key = db.code_from_id(line.nomen) + '|' + db.code_from_id(doc.stock1)
            // второй параметр get(, true) - запрет скана, ищем только в кэше
            const bal = db.get_top(bal_key, true)?.value ?? 0
            if (bal < line.qty) return [false, `"${bal_key}": requested ${line.qty} but balance is only ${bal}`]
        }
        return [true,]
    }

    static after_add(doc: Document, db: IDBCore): void {
        doc.lines.forEach(line => {
            let bal_key = db.code_from_id(line.nomen) + '|' + db.code_from_id(doc.stock1)
            let bal_old = db.get_top(bal_key, true)?.value ?? 0
            let bal_new = {sys: {class: "bal_qty", code: bal_key}, value: bal_old - line.qty}
            db.add_mut(bal_new)

            bal_key = db.code_from_id(line.nomen) + '|' + db.code_from_id(doc.stock2)
            bal_old = db.get_top(bal_key, true)?.value ?? 0
            bal_new = {sys: {class: "bal_qty", code: bal_key}, value: bal_old + line.qty}
            db.add_mut(bal_new)
        })
    }
}

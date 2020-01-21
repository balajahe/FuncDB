import { Document, DocClass, IDBCore } from '../core/DBMeta.ts'

export default class extends DocClass {
    static after_add(doc: Document, db: IDBCore): void {
        super.after_add(doc, db)
        doc.lines.forEach(l => {
            console.log(l.qty)
        })
    }
}

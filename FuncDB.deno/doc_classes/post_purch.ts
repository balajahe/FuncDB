import { Document, DocClass, IERPCore } from '../core/ERPMeta.ts'

export default class PostPurch extends DocClass {
    static after_add(doc: Document, db: IERPCore): void {
        doc.lines.forEach(line => {
            const bal = db.get_bal([line.nomen, doc.stock])
            bal.qty += line.qty
            bal.val += line.qty * line.price
            db.add_mut(bal)
        })
    }
}

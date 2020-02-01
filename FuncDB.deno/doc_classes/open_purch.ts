import { Document, DocClass, IERPCore } from '../core/ERPMeta.ts'

export default class OpenPurch extends DocClass {
    static after_add(doc: Document, db: IERPCore): void {
        doc.lines.forEach(line => {
            const bal = db.get_bal([line.nomen, doc.stock])
            bal.iqty += line.qty
            bal.ival += line.qty * line.price
            db.add_mut(bal)
        })
    }
}

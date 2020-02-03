import { Document, DocClass, IERPCore } from '../core/ERPMeta.ts'

export default class OpenPurch extends DocClass {

    static on_add(doc: Document, db: IERPCore): [boolean, string?] {
        doc.lines.forEach(line => {
            const bal = db.get_bal([line.nomen, doc.stock])
            bal.iqty += line.qty
            bal.ival += line.qty * line.price
            bal.from = doc.id
            db.add_mut(bal)
        })
        return [true,]
    }
}

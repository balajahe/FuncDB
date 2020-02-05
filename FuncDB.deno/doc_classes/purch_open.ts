import { Document, DocClass, IERPCore } from '../core/ERPMeta.ts'

export default class PurchOpen extends DocClass {

    static on_add(doc: Document, db: IERPCore): [boolean, string?] {
        doc.lines.forEach(line => {
            const bal = db.get_bal('bal+', [line.nomen, doc.stock])
            bal.qty += line.qty
            bal.val += line.qty * line.price
            bal.from = doc.id
            db.add(bal)
        })
        return [true,]
    }
}

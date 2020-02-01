import { Document, DocClass, IERPCore } from '../core/ERPMeta.ts'

export default class OpenSale extends DocClass {
    static after_add(doc: Document, db: IERPCore): void {
        doc.lines.forEach(line => {
            const bal = db.get_bal([line.nomen, doc.stock])
            line.from = bal.id
            line.cost = (bal.val + bal.ival) / (bal.qty + bal.iqty) // себестоимость в момент списания с учетом ожидаемых приходов
            bal.oqty -= line.qty
            bal.oval -= line.qty * line.cost
            db.add_mut(bal)
        })
    }
}

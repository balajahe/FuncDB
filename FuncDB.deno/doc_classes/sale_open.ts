import { Document, DocClass, IERPCore } from '../core/ERPMeta.ts'

export default class SaleOpen extends DocClass {

    static on_add(doc: Document, db: IERPCore): [boolean, string?] {
        doc.lines.forEach(line => {
            const bal = db.get_bal('bal-', [line.nomen, doc.stock])
            line.from = bal.id
            //line.cost = bal.val / bal.qty // себестоимость в момент списания
            bal.qty -= line.qty
            //bal.val -= line.qty * line.cost
            bal.val = 0
            bal.from = doc.id
            db.add(bal)
        })
        return [true,]
    }
}
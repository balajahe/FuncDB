import { Document, DocClass, IERPCore } from '../core/ERPMeta.ts'

export default class ProdOutPost extends DocClass {
    
    static on_add(doc: Document, db: IERPCore): [boolean, string?] {
        doc.lines.forEach(line => {
            let bal = db.get_bal('bal=', [line.nomen, doc.prod])
            bal.qty -= line.qty
            bal.val -= line.qty * line.cost_norm
            bal.from = doc.id
            db.add(bal)


            bal = db.get_bal('bal=', [line.nomen, doc.stock])
            bal.qty += line.qty
            bal.val += line.qty * line.cost_norm
            bal.from = doc.id
            db.add(bal)
        })
        return [true,]
    }
}

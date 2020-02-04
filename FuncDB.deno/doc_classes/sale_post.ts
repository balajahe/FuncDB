import { Document, DocClass, IERPCore } from '../core/ERPMeta.ts'

export default class SalePost extends DocClass {
    
    static on_add(doc: Document, db: IERPCore): [boolean, string?] {
        let err = ''
        doc.lines.forEach(line => {
            const balkey = db.balkey_from_ids('bal=', [line.nomen, doc.stock])
            const bal = db.get_bal_by_key(balkey)
            if (bal.qty >= line.qty) {
                line.from = bal.id
                line.cost = bal.val / bal.qty // себестоимость в момент списания
                bal.qty -= line.qty
                bal.val -= line.qty * line.cost
                bal.from = doc.id
                db.add_mut(bal)
            } else {
                err += '\n"' + balkey + '": requested ' + line.qty + ' but balance is only ' + bal.qty
            }
        })
        return err === '' ? [true,] : [false, err] 
    }
}

import { Document, DocClass, IERPCore } from '../core/ERPMeta.ts'

export default class SalePosted extends DocClass {
    
    static on_add(doc: Document, db: IERPCore): [boolean, string?] {
        let ok = true
        let err = ''
        doc.lines.forEach(line => {
            const balkey = db.balkey_from_ids('bal=', [line.nomen, doc.stock])
            const bal = db.get_bal_by_key(balkey)
            if (bal.qty >= line.qty) {
                line.cost = bal.val / bal.qty // себестоимость в момент списания
                line.from = bal.id
                bal.qty -= line.qty
                bal.val -= line.qty * line.cost
                bal.from = doc.id
                db.add(bal)
            } else {
                ok = false
                err += '\n"' + balkey + '" - requested "' + line.qty + '" but balance is only "' + bal.qty + '"'
            }
        })
        if (!ok) err = 'ERROR adding "' + doc.type + '":' + err 
        return [ok, err] 
    }
}

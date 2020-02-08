import { Document, DocClass, IERPCore } from '../core/ERPMeta.ts'

export default class ProdInPost extends DocClass {
    
    static on_add(doc: Document, db: IERPCore): [boolean, string?] {
        let ok = true
        let err = ''
        doc.lines.forEach(line => {
            const balkey = db.balkey_from_ids('bal=', [line.nomen, doc.stock])
            let bal = db.get_bal_by_key(balkey)
            if (bal.qty >= line.qty) {
                line.from = bal.id
                line.cost = bal.val / bal.qty // себестоимость в момент списания
                bal.qty -= line.qty
                bal.val -= line.qty * line.cost
                bal.from = doc.id
                db.add(bal)

                bal = db.get_bal('bal=', [line.nomen, doc.prod])
                bal.qty += line.qty
                bal.val += line.qty * line.cost
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

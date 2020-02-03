import { Document, DocClass, IERPCore } from '../core/ERPMeta.ts'

export default class PostTransfer extends DocClass {

    static on_add(doc: Document, db: IERPCore): [boolean, string?] {
        let err = ''
        doc.lines.forEach(line => {
            let balkey = [line.nomen, doc.stock1]
            let bal = db.get_bal(balkey)
            if (bal.qty >= line.qty) {
                line.from = bal.id
                line.cost = (bal.val + bal.ival) / (bal.qty + bal.iqty) // себестоимость в момент списания с учетом ожидаемых приходов
                bal.qty -= line.qty
                bal.val -= line.qty * line.cost
                bal.from = doc.id
                db.add_mut(bal)

                bal = db.get_bal([line.nomen, doc.stock2])
                bal.qty += line.qty
                bal.val += line.qty * line.cost
                bal.from = doc.id
                db.add_mut(bal)
            } else {
                err += '\n"' + balkey + '": requested ' + line.qty + ' but balance is only ' + bal.qty
            }
        })
        return err === '' ? [true,] : [false, err] 
    }
}

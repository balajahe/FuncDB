import { Document, DocClass, IERPCore } from '../core/ERPMeta.ts'

export default class PostSale extends DocClass {
    static before_add(doc: Document, db: IERPCore): [boolean, string?] {
        let err = ''
        doc.lines.forEach(line => {
            const key = [line.nomen, doc.stock]
            const bal = db.get_bal(key)
            if (bal.qty < line.qty) {
                err += '\n"' + key + '": requested ' + line.qty + ' but balance is only ' + bal.qty
            }
        })
        return  err !== '' ? [false, err] : [true,]
    }

    static after_add(doc: Document, db: IERPCore): void {
        doc.lines.forEach(line => {
            const bal = db.get_bal([line.nomen, doc.stock])
            line.from = bal.id
            line.cost = (bal.val + bal.ival) / (bal.qty + bal.iqty) // себестоимость в момент списания с учетом ожидаемых приходов
            bal.qty -= line.qty
            bal.val -= line.qty * line.cost
            db.add_mut(bal)
        })
    }
}

import { Document, DocClass, IERPCore } from '../core/ERPMeta.ts'

export default class ProdOutPosted extends DocClass {
    
    static on_add(doc: Document, db: IERPCore): [boolean, string?] {
        const prod = db.get(doc.prod)
        if (prod === undefined) throw 'ERROR: document "' + doc.prod + '" is not found !'
        doc.lines.forEach(line => {
            let prod_line = prod.lines.find(l => l.nomen === line.nomen)
            //if (prod_line === undefined) throw 'ERROR adding "prod.out" - standard cost for nomen "' + line.nomen + '" is not found !'
            if (prod_line === undefined) prod_line = line // заглушка
            let bal = db.get_bal('bal=', [line.nomen, doc.prod])
            bal.qty -= line.qty
            bal.val -= line.qty * prod_line.cost_std
            bal.from = doc.id
            db.add(bal)


            bal = db.get_bal('bal=', [line.nomen, doc.stock])
            bal.qty += line.qty
            bal.val += line.qty * line.cost_std
            bal.from = doc.id
            db.add(bal)
        })
        return [true,]
    }
}

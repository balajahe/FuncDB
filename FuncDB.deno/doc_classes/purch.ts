import { Document, DocClass } from '../core/DBMeta.ts'
import { DBCore } from '../core/DBCore.ts'

export default class extends DocClass {
    static after_add(doc: Document): void {
        super.after_add(doc)
        doc.lines.forEach(l => {
            console.log(l.qty)
        })
    }
}

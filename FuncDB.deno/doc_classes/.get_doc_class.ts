import { DocClass } from '../core/ERPMeta.ts' 

import ref from './ref.ts'
import bal from './bal.ts'
import post_purch from './post_purch.ts'
import post_sale from './post_sale.ts'
import post_transfer from './post_transfer.ts'
import open_purch from './open_purch.ts'
import open_sale from './open_sale.ts'

export function get_doc_class(type: string) { // : DocClass { как указать что возвращается не инстанс, а сам класс ?
    switch (type) {
        case 'person': return ref
        case 'nomen': return ref
        case 'stock': return ref
        case 'bal': return bal
        case 'post.purch': return post_purch
        case 'post.sale': return post_sale
        case 'post.transfer': return post_transfer
        case 'open.purch': return open_purch
        case 'open.sale': return open_sale
        default: throw `Error: document type "${type}" is not registered in doc_classes !`
    }
}

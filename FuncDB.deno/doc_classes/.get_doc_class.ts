import { DocClass } from '../core/ERPMeta.ts' 

import ref from './ref.ts'
import bal from './bal.ts'
import purch_post from './purch_post.ts'
import purch_open from './purch_open.ts'
import sale_post from './sale_post.ts'
import sale_open from './sale_open.ts'
import transfer_post from './transfer_post.ts'

export function get_doc_class(type: string) { // : DocClass { как указать что возвращается не инстанс, а сам класс ?
    switch (type) {
        case 'person': return ref
        case 'nomen': return ref
        case 'stock': return ref
        case 'bal=': return bal
        case 'bal+': return bal
        case 'bal-': return bal
        case 'purch.post': return purch_post
        case 'purch.open': return purch_open
        case 'sale.post': return sale_post
        case 'sale.open': return sale_open
        case 'transfer.post': return transfer_post
        default: throw `Error: document type "${type}" is not registered in doc_classes !`
    }
}

import { DocClass } from '../core/ERPMeta.ts' 

import ref from './ref.ts'
import bal from './bal.ts'
import doc_open from './doc_open.ts'

import purch_open from './purch_open.ts'
import purch_posted from './purch_posted.ts'
import sale_open from './sale_open.ts'
import sale_posted from './sale_posted.ts'
import transfer_posted from './transfer_posted.ts'

import prod_in_posted from './prod_in_posted.ts'
import prod_out_posted from './prod_out_posted.ts'

export function get_doc_class(type: string) { // : DocClass { как указать что возвращается не инстанс, а сам класс ?
    switch (type) {
        case 'person': return ref
        case 'nomen': return ref
        case 'stock': return ref

        case 'bal=': return bal
        case 'bal+': return bal
        case 'bal-': return bal

        case 'purch.posted': return purch_posted
        case 'purch.open': return purch_open
        case 'sale.posted': return sale_posted
        case 'sale.open': return sale_open
        case 'transfer.posted': return transfer_posted

        case 'prod.open': return doc_open
        case 'prod.closed': return DocClass
        case 'prod.in.posted': return prod_in_posted
        case 'prod.out.posted': return prod_out_posted

        default: throw `ERROR: document type "${type}" is not registered in "doc_classes/get_doc_class()" !`
    }
}

import { DocClass } from '../core/DBMeta.ts' 

import ref from './ref.ts'
import bal from './bal.ts'
import purch from './purch.ts'
import sale from './sale.ts'
import transfer from './transfer.ts'

export function get_doc_class(type: string) { // : DocClass { как указать что возвращается не инстанс, а сам класс ?
    switch (type) {
        case 'person': return ref
        case 'nomen': return ref
        case 'stock': return ref
        case 'bal': return bal
        case 'purch': return purch
        case 'sale': return sale
        case 'transfer': return transfer
        default: throw `Error: document type "${type}" is not registered in doc_classes !`
    }
}

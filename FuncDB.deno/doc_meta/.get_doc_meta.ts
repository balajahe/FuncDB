import { DocMeta } from '../core/DBMeta.ts' 

import ref from './ref.ts'
import bal from './bal.ts'
import purch from './purch.ts'
import sale from './sale.ts'
import transfer from './transfer.ts'

export function get_doc_meta(type: string) { // : DocMeta { как указать что возвращается не инстанс, а сам класс ?
    switch (type) {
        case 'ref': return ref
        case 'bal': return bal
        case 'purch': return purch
        case 'sale': return sale
        case 'transfer': return transfer
        default: throw `Error: type "${type}" is not registered in doc_meta !`
    }
}

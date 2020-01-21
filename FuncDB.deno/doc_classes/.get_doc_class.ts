import { DocClass } from '../core/DBMeta.ts' 

import ref from './ref.ts'
import purch from './purch.ts'
import balance from './balance.ts'

export function get_doc_class(classname: string) { // : DocClass { непонятно как указать, что возвращается тип
    switch (classname) {
        case 'ref': return ref
        case 'purch': return purch
        case 'balance': return balance
        case 'sale': return DocClass
        case 'transfer': return DocClass
        default: throw `Error: doc class "${classname}" is not registered !`
    }
}

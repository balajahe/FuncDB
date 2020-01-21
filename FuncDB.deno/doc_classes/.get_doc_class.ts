import { DocClass } from '../core/DBMeta.ts' 

import ref from './ref.ts'
import purch from './purch.ts'

export function get_doc_class(classname: string) {
    switch (classname) {
        case 'ref': return ref
        case 'purch': return purch
        default: return DocClass
    }
}

import { Balance, IERPCore } from './ERPMeta.ts' 
import { DBCore } from './DBCore.ts'

export class ERPCore extends DBCore implements IERPCore {
    static open(dbpath: string, no_cache: boolean = false): ERPCore {
        const db = new ERPCore(dbpath)
        db.init()
        return db
    }
   
    bal_key_from_ids(ids: string[]): string {
        let key = 'bal'
        for (const id of ids) {
            key += '|' + this.key_from_id(id)
        }
        return key
    }

    get_bal_by_key(key: string): Balance {
        let bal = this.get_top(key, true) 
        if (bal === undefined) {
            bal = {
                type: 'bal',
                key: key,
                id: undefined,
                qty: 0,
                val: 0,
                iqty: 0,
                ival: 0,
                oqty: 0,
                oval: 0,
            }
        } else {
            bal = Object.assign({}, bal)
        }
        return bal
    }

    get_bal(ids: string[]): Balance {
        const key = this.bal_key_from_ids(ids)
        return this.get_bal_by_key(key)
    }
}
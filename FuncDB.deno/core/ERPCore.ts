import { BalType, Balance, IERPCore } from './ERPMeta.ts' 
import { DBCore } from './DBCore.ts'

export class ERPCore extends DBCore implements IERPCore {
    static open(dbpath: string, no_cache: boolean = false): ERPCore {
        return <ERPCore>new ERPCore(dbpath).init()
    }
   
    balkey_from_ids(type: BalType, ids: string[]): string {
        let key = type
        for (const id of ids) {
            key += '|' + this.key_from_id(id)
        }
        return key
    }

    get_bal_by_key(key: string): Balance {
        let bal = this.get_top(key, true)
        if (bal !== undefined) {
            bal = Object.assign({}, bal)
        } else {
            bal = {
                type: key.slice(0, key.indexOf('|')),
                key: key,
                id: undefined,
                from: undefined,
                qty: 0,
                val: 0,
            }
        }
        return bal
    }

    get_bal(type: BalType, ids: string[]): Balance {
        return this.get_bal_by_key(this.balkey_from_ids(type, ids))
    }
}

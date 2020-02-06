import { BalType, Balance, IERPCore } from './ERPMeta.ts' 
import { DBCore, Document, Accumulator } from './DBCore.ts'

export { Document, Accumulator }

export class ERPCore extends DBCore implements IERPCore {
   
    balkey_from_ids(type: BalType, ids: string[]): string {
        let key = type
        for (const id of ids) {
            key += '|' + this.key_from_id(id)
        }
        return key
    }

    get_bal_by_key(key: string): Balance {
        let bal = this.get_top(key, false)
        if (bal !== undefined) {
            bal = Object.assign({}, bal)
        } else {
            bal = {
                type: key.slice(0, key.indexOf('|')),
                key: key,
                id: this.id_from_key(key),
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

    recreate_bals() {
        this.recreate_current(
            (_, doc) => { 
                if (!doc.type.startsWith('bal')) {
                    const [ok, err] = this.add(doc)
                    if (!ok) throw err
                }
            },
            {}
        )
    }
}

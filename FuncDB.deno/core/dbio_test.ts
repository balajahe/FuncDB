import { DBReader, DBReaderSync, DBReaderAsync } from './DBIO.ts'
import { DBMeta } from './DBMeta.ts'

let db: DBReader
let begin: number

// sync
db = new DBReaderSync('../sample_database/' + DBMeta.immut_data_file) 
begin = Date.now()
for (let s = db.get_sync(); s; s = db.get_sync()) {
    //console.log(JSON.stringify(s) + '\n-----------------------------------')
}
console.log('sync: ' + (Date.now() - begin) / 1000 + 's')

// async
db = new DBReaderAsync('../sample_database/' + DBMeta.immut_data_file) 
begin = Date.now()
for (let s = await db.get_async(); s; s = await db.get_async()) {
    //console.log(JSON.stringify(s) + '\n-----------------------------------')
}
console.log('async: ' + (Date.now() - begin) / 1000 + 's')

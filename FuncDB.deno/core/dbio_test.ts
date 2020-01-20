import { DBReader, DBReaderSync, DBReaderAsync } from './DBIO.ts'
import { DBMeta } from './DBMeta.ts'

let db: DBReader
let begin: number

// sync
db = new DBReaderSync('../sample_database/' + DBMeta.data_immut) 
begin = Date.now()
for (let s = db.next(); s; s = db.next()) {
    //console.log(JSON.stringify(s) + '\n-----------------------------------')
}
console.log('sync: ' + (Date.now() - begin) / 1000 + 's')

// async
db = new DBReaderAsync('../sample_database/' + DBMeta.data_immut) 
begin = Date.now()
for (let s = await db.next(); s; s = await db.next()) {
    //console.log(JSON.stringify(s) + '\n-----------------------------------')
}
console.log('async: ' + (Date.now() - begin) / 1000 + 's')

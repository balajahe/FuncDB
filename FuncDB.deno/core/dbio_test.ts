import { IDBReader, DBReaderSync, DBReaderAsync } from './DBIO.ts'
import { DBMeta } from './DBMeta.ts'

let db: IDBReader
let begin: number

// sync
db = new DBReaderSync('../database/' + DBMeta.data_immut) 
begin = Date.now()
for (let s = db.next(); s; s = db.next()) {
    //console.log(JSON.stringify(s, null, '\t') + '\n-----------------------------------')
}
console.log('sync: ' + (Date.now() - begin) / 1000 + 's')

// async
db = new DBReaderAsync('../database/' + DBMeta.data_immut) 
begin = Date.now()
for (let s = await db.next(); s; s = await db.next()) {
    //console.log(JSON.stringify(s, null, '\t') + '\n-----------------------------------')
}
console.log('async: ' + (Date.now() - begin) / 1000 + 's')

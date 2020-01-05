import { BufWriter } from "https://deno.land/std/io/bufio.ts";

Deno.mkdirSync('sample_database');
await generate('sample_database/database_immutable.json', 5, 100, true)
await generate('sample_database/database_current.json', 5, 100, false)

async function generate(fname: string, diccou: number, doccou: number, compact: boolean = false) {
    const wr = new BufWriter(Deno.openSync(fname, 'w'))

    const partner_types = ['retail', 'wholesale']
    const partner_ts = Date.now()
    for (let i=0; i<diccou; i++) {
        let doc = `
            {
                "sys": {
                    "code": "partner.${i}",
                    "ts": ${partner_ts},
                    "id": "partner.${i}|${partner_ts}",
                    "tocache": 1     
                },
                "name": "partner ${i}",
                "type": "partner.${arand(partner_types)}"
            }`
        if (compact) doc = JSON.stringify(JSON.parse(doc))
        await wr.write(new TextEncoder().encode(doc + '\x01'))
    }

    const invent_types = ['tool', 'material', 'asset']
    const invent_ts = Date.now()
    for (let i=0; i<diccou; i++) {
        const ts = Date.now()
        let doc = `
            {
                "sys": {
                    "code": "invent.${i}",
                    "ts": ${invent_ts},
                    "id": "invent.${i}|${invent_ts}",
                    "tocache": 1     
                },
                "name": "invent ${i}",
                "type": "invent.${arand(invent_types)}"
            }`
        if (compact) doc = JSON.stringify(JSON.parse(doc))
        await wr.write(new TextEncoder().encode(doc + '\x01'))
    }

    const doc_types = ['purch', 'sale']
    for (let i=0; i<doccou; i++) {
        const ts = Date.now()
        const type = arand(doc_types)
        const partner = 'partner.' + irand(0,diccou-1) + '|' + partner_ts
        let lines = '['
        for (let j=0; j<irand(1,10); j++) {
            const invent = 'invent.' + irand(0,diccou-1) + '|' + invent_ts
            if (j > 0) lines += ','
            lines += `
                    {
                        "invent": "${invent}",
                        "qty": ${irand(1,30)},
                        "price": ${frand(100,300)}
                    }`
        }
        lines += `
                ]`
        let doc = `
            {
                "sys": {
                    "code": "${type}.${i}",
                    "ts": ${ts},
                    "id": "${type}.${i}|${ts}"  
                },
                "type": "${type}",
                "partner": "${partner}",
                "lines": ${lines}
            }`
        if (compact) doc = JSON.stringify(JSON.parse(doc))
        await wr.write(new TextEncoder().encode(doc + '\x01'))
    }

    await wr.flush()
}

function frand(min, max) {
    let rand = min + Math.random() * (max - min);
    return rand;
}

function irand(min, max) {
    let rand = min + Math.random() * (max + 1 - min);
    return Math.floor(rand);
}
  
function arand(arr: any[]) {
    const rand = Math.random() * arr.length
    return arr[Math.floor(rand)]
}
